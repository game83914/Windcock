import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VoteDto } from './vote.dto';

describe('VoteDto optionIds', () => {
  async function errorsFor(payload: unknown) {
    return validate(plainToInstance(VoteDto, payload), { whitelist: true });
  }

  it('accepts numeric strings from JSON clients', async () => {
    expect(await errorsFor({ optionIds: ['112', '113'] })).toHaveLength(0);
  });

  it('accepts numbers', async () => {
    expect(await errorsFor({ optionIds: [112, 113] })).toHaveLength(0);
  });

  it('rejects non-integers and values below 1', async () => {
    expect((await errorsFor({ optionIds: ['0'] })).length).toBeGreaterThan(0);
    expect((await errorsFor({ optionIds: ['1.5'] })).length).toBeGreaterThan(0);
    expect((await errorsFor({ optionIds: ['abc'] })).length).toBeGreaterThan(0);
    expect((await errorsFor({ optionIds: [] })).length).toBeGreaterThan(0);
  });
});
