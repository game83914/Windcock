import { BadRequestException, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalTurnstileSecret = process.env.TURNSTILE_SECRET;
  const originalFetch = global.fetch;
  const originalAllowedPhones = process.env.ALLOWED_LOGIN_PHONES;

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
    process.env.TURNSTILE_SECRET = originalTurnstileSecret;
    process.env.ALLOWED_LOGIN_PHONES = originalAllowedPhones;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function setup(overrides: { increments?: number[]; storedCode?: string | null; consumed?: boolean } = {}) {
    process.env.ALLOWED_LOGIN_PHONES = '0912345678';
    const increments = [...(overrides.increments ?? [1, 1, 1])];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };
    const redis = {
      incr: jest.fn().mockImplementation(() => Promise.resolve(increments.shift() ?? 1)),
      expire: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(overrides.storedCode ?? null),
      del: jest.fn().mockResolvedValue(undefined),
      consumeIfMatches: jest.fn().mockResolvedValue(overrides.consumed ?? true),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    const sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    return { service: new AuthService(prisma as never, redis as never, jwt as never, sms as never), prisma, redis, sms };
  }

  it('validates Turnstile before issuing an OTP', async () => {
    process.env.TURNSTILE_SECRET = 'secret';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success: false }) }) as never;
    const { service, sms } = setup();

    await expect(service.sendOtp('0912345678', 'invalid-token', '203.0.113.1')).rejects.toBeInstanceOf(BadRequestException);
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it('rejects phone numbers outside the login allowlist before sending an OTP', async () => {
    const { service, sms } = setup();
    process.env.ALLOWED_LOGIN_PHONES = '0911111111';

    await expect(service.sendOtp('0912345678')).rejects.toBeInstanceOf(HttpException);
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it('rate-limits OTP sends by requester IP', async () => {
    delete process.env.TURNSTILE_SECRET;
    const { service, redis, sms } = setup({ increments: [1, 1, 21] });

    await expect(service.sendOtp('0912345678', undefined, '203.0.113.1')).rejects.toBeInstanceOf(HttpException);
    expect(redis.incr).toHaveBeenCalledWith('otp:ip:203.0.113.1:d1');
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it('rejects an OTP that another request already consumed', async () => {
    const { service, prisma, redis } = setup({ storedCode: 'ABC123', consumed: false });

    await expect(service.verifyOtp('0912345678', 'ABC123')).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.consumeIfMatches).toHaveBeenCalledWith('otp:code:0912345678', 'ABC123');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('invalidates an OTP after too many verification attempts', async () => {
    const { service, redis } = setup({ increments: [6], storedCode: 'ABC123' });

    await expect(service.verifyOtp('0912345678', 'ABC123')).rejects.toBeInstanceOf(HttpException);
    expect(redis.del).toHaveBeenCalledWith('otp:code:0912345678');
    expect(redis.consumeIfMatches).not.toHaveBeenCalled();
  });
});
