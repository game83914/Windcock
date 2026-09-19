import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = required('ADMIN_EMAIL').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD is required');
  const nickname = process.env.ADMIN_NICKNAME?.trim() || '最高管理員';
  const phoneNumber = process.env.ADMIN_PHONE?.trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be 8 to 72 bytes');
  }
  if (nickname.length < 2 || nickname.length > 20) {
    throw new Error('ADMIN_NICKNAME must be 2 to 20 characters');
  }
  if (phoneNumber && !/^09\d{8}$/.test(phoneNumber)) {
    throw new Error('ADMIN_PHONE must use the 09xxxxxxxx format');
  }

  if (phoneNumber) {
    const phoneOwner = await prisma.user.findUnique({
      where: { phoneNumber },
      select: { email: true },
    });
    if (phoneOwner && phoneOwner.email?.toLowerCase() !== email) {
      throw new Error(`ADMIN_PHONE is already used by ${phoneOwner.email ?? 'another account'}`);
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true },
  });
  if (existing && (existing.role !== 'ADMIN' || existing.status !== 'ACTIVE')) {
    if (process.env.ADMIN_ALLOW_TAKEOVER !== 'yes') {
      throw new Error(
        `Refusing to take over existing account ${email} (role=${existing.role}, status=${existing.status}). ` +
          'Set ADMIN_ALLOW_TAKEOVER=yes to promote it explicitly.',
      );
    }
    console.warn(`Promoting existing account ${email} to ADMIN (explicit takeover).`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      passwordUpdatedAt: new Date(),
      nickname,
      role: 'ADMIN',
      membershipTier: 'SENIOR',
      status: 'ACTIVE',
      ...(phoneNumber ? { phoneNumber, isPhoneVerified: true } : {}),
    },
    create: {
      email,
      passwordHash,
      passwordUpdatedAt: new Date(),
      nickname,
      phoneNumber,
      role: 'ADMIN',
      membershipTier: 'SENIOR',
      status: 'ACTIVE',
      isPhoneVerified: Boolean(phoneNumber),
    },
  });

  console.log(`Administrator provisioned: ${email}${existing ? ' (existing account updated)' : ''}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
