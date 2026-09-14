import { NotFoundException } from '@nestjs/common';
import { DevIdentityService } from './dev-identity.service';

describe('DevIdentityService', () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalFlag = process.env.DEV_IDENTITY_SWITCHER_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
    process.env.DEV_IDENTITY_SWITCHER_ENABLED = originalFlag;
  });

  function createService() {
    return new DevIdentityService({} as never, {} as never, {} as never, {} as never);
  }

  it('refuses to start if explicitly enabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_IDENTITY_SWITCHER_ENABLED = 'true';
    expect(() => createService()).toThrow('cannot be enabled in production');
  });

  it('hides the feature when disabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_IDENTITY_SWITCHER_ENABLED = 'false';
    await expect(createService().profiles({ userId: 1n } as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});
