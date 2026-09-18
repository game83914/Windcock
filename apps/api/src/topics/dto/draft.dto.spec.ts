import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DraftKind } from '@prisma/client';
import { ListDraftsQuery } from './draft.dto';

describe('ListDraftsQuery', () => {
  it.each([['false'], ['true']])('keeps query string template=%s as-is (service translates it)', async (input) => {
    const value = plainToInstance(ListDraftsQuery, { kind: DraftKind.QUICK, template: input }, { enableImplicitConversion: true });

    await expect(validate(value as object, { whitelist: true })).resolves.toHaveLength(0);
    expect(value.template).toBe(input);
  });

  it('leaves template undefined when absent', async () => {
    const value = plainToInstance(ListDraftsQuery, { kind: DraftKind.SURVEY }, { enableImplicitConversion: true });

    await expect(validate(value as object, { whitelist: true })).resolves.toHaveLength(0);
    expect(value.template).toBeUndefined();
  });

  it('rejects non-boolean template values', async () => {
    const value = plainToInstance(ListDraftsQuery, { template: 'yes' }, { enableImplicitConversion: true });
    const errors = await validate(value as object, { whitelist: true });

    expect(errors.some((error) => error.property === 'template')).toBe(true);
  });
});
