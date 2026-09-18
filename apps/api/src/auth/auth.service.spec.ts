import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

describe('AuthService', () => {
  const originalTurnstileSecret = process.env.TURNSTILE_SECRET;
  const originalFetch = global.fetch;
  const originalLoginMaxPerIpDay = process.env.LOGIN_MAX_PER_IP_DAY;
  const originalLoginMaxPerAcctHour = process.env.LOGIN_MAX_PER_ACCT_HOUR;

  afterEach(() => {
    process.env.TURNSTILE_SECRET = originalTurnstileSecret;
    process.env.LOGIN_MAX_PER_IP_DAY = originalLoginMaxPerIpDay;
    process.env.LOGIN_MAX_PER_ACCT_HOUR = originalLoginMaxPerAcctHour;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function setup(overrides: { increments?: number[] } = {}) {
    delete process.env.TURNSTILE_SECRET;
    // Pin rate limits: ambient env must not change test behavior.
    process.env.LOGIN_MAX_PER_IP_DAY = '100';
    process.env.LOGIN_MAX_PER_ACCT_HOUR = '10';
    const increments = [...(overrides.increments ?? [1, 1])];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const redis = {
      incr: jest.fn().mockImplementation(() => Promise.resolve(increments.shift() ?? 1)),
      expire: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    return { service: new AuthService(prisma as never, redis as never, jwt as never), prisma, redis, jwt };
  }

  function sessionUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 1n,
      email: 'user@example.com',
      nickname: '測試用戶',
      avatarUrl: null,
      pointsBalance: 0n,
      role: 'USER',
      status: 'ACTIVE',
      isPhoneVerified: false,
      ...overrides,
    };
  }

  describe('register', () => {
    it('creates a user with a bcrypt hash and issues a JWT', async () => {
      const { service, prisma, jwt } = setup();
      prisma.user.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 1n, ...args.data }),
      );
      prisma.user.findUniqueOrThrow.mockResolvedValue(sessionUser());

      const result = await service.register(
        { email: 'User@Example.com', password: 's3cur3-pass', nickname: '測試用戶' } as RegisterDto,
        '203.0.113.1',
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.email).toBe('user@example.com');
      expect(created.phoneNumber).toBeNull();
      expect(created.passwordHash).not.toBe('s3cur3-pass');
      expect(await bcrypt.compare('s3cur3-pass', created.passwordHash)).toBe(true);
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: '1', email: 'user@example.com' });
      expect(result.accessToken).toBe('token');
      expect(result.user.email).toBe('user@example.com');
    });

    it('rejects a duplicate email', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(sessionUser());

      await expect(
        service.register({ email: 'user@example.com', password: 's3cur3-pass', nickname: '測試用戶' } as RegisterDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a short password at the DTO level', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'user@example.com',
        password: 'short',
        nickname: '測試用戶',
      });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'password')).toBe(true);
    });
  });

  describe('login', () => {
    it('issues a JWT when credentials are correct', async () => {
      const { service, prisma, jwt, redis } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...sessionUser(),
        passwordHash: await bcrypt.hash('s3cur3-pass', 4),
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue(sessionUser());

      const result = await service.login(
        { email: 'USER@example.com', password: 's3cur3-pass' } as LoginDto,
        '203.0.113.1',
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      expect(redis.incr).toHaveBeenCalledWith('login:ip:203.0.113.1:d1');
      expect(redis.incr).toHaveBeenCalledWith('login:acct:1:h1');
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: '1', email: 'user@example.com' });
      expect(result.accessToken).toBe('token');
    });

    it('returns 401 for a wrong password without revealing the cause', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...sessionUser(),
        passwordHash: await bcrypt.hash('s3cur3-pass', 4),
      });

      const error = await service
        .login({ email: 'user@example.com', password: 'wrong-pass' } as LoginDto)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe('帳號或密碼不正確');
    });

    it('returns 401 for an unknown email without revealing the cause', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(null);

      const error = await service
        .login({ email: 'nobody@example.com', password: 'whatever-123' } as LoginDto)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe('帳號或密碼不正確');
    });

    it('rate-limits logins by requester IP', async () => {
      const { service, redis } = setup({ increments: [101] });

      const error = await service
        .login({ email: 'user@example.com', password: 's3cur3-pass' } as LoginDto, '203.0.113.1')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect(redis.incr).toHaveBeenCalledWith('login:ip:203.0.113.1:d1');
    });

    it('validates Turnstile before checking credentials', async () => {
      const { service, prisma } = setup();
      process.env.TURNSTILE_SECRET = 'secret';
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success: false }) }) as never;

      await expect(
        service.login({ email: 'user@example.com', password: 's3cur3-pass', turnstileToken: 'bad' } as LoginDto, '203.0.113.1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('updates the hash when the old password matches', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...sessionUser(),
        passwordHash: await bcrypt.hash('old-pass-123', 4),
      });
      prisma.user.update.mockResolvedValue(sessionUser());

      const result = await service.changePassword(1n, { oldPassword: 'old-pass-123', newPassword: 'new-pass-456' });

      expect(result).toEqual({ success: true });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.passwordUpdatedAt).toBeInstanceOf(Date);
      expect(await bcrypt.compare('new-pass-456', data.passwordHash)).toBe(true);
    });

    it('rejects a wrong old password', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...sessionUser(),
        passwordHash: await bcrypt.hash('old-pass-123', 4),
      });

      await expect(service.changePassword(1n, { oldPassword: 'nope-nope-123', newPassword: 'new-pass-456' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
