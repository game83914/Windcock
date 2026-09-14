import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function defaultSchemaName() {
  return `backup_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
}

async function main() {
  const schema = process.env.BACKUP_SCHEMA || defaultSchemaName();
  if (!/^backup_[a-zA-Z0-9_]+$/.test(schema)) throw new Error('BACKUP_SCHEMA must start with backup_ and contain only letters, numbers, or underscores');

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  if (!tables.length) throw new Error('No public tables found');
  const enumColumns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT columns.table_name, columns.column_name
    FROM information_schema.columns AS columns
    JOIN pg_type AS types ON types.typname = columns.udt_name
    JOIN pg_namespace AS namespaces ON namespaces.oid = types.typnamespace
    WHERE columns.table_schema = 'public' AND namespaces.nspname = 'public' AND types.typtype = 'e'
    ORDER BY columns.table_name, columns.ordinal_position
  `;

  const counts = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('windcock-database-maintenance'))::text AS locked`;
    await tx.$executeRawUnsafe(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    const copied: Array<{ table: string; rows: number }> = [];
    for (const { table_name: table } of tables) {
      const quotedTable = quoteIdentifier(table);
      await tx.$executeRawUnsafe(`CREATE TABLE ${quoteIdentifier(schema)}.${quotedTable} AS TABLE public.${quotedTable}`);
      const [source] = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM public.${quotedTable}`);
      const [backup] = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(schema)}.${quotedTable}`);
      if (source.count !== backup.count) throw new Error(`Backup verification failed for ${table}`);
      copied.push({ table, rows: Number(source.count) });
    }
    for (const { table_name: table, column_name: column } of enumColumns) {
      const target = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      const quotedColumn = quoteIdentifier(column);
      await tx.$executeRawUnsafe(`ALTER TABLE ${target} ALTER COLUMN ${quotedColumn} TYPE TEXT USING ${quotedColumn}::text`);
    }
    return copied;
  }, { timeout: 120_000 });

  console.log(JSON.stringify({ schema, tables: counts.length, rows: counts.reduce((sum, item) => sum + item.rows, 0), counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
