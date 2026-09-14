import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * SMS gateway abstraction.
 * When SMS_PROVIDER is empty (test/dev mode), the OTP is logged so test
 * accounts can read the code from the server console. Swap in a real
 * provider (三竹 / Every8d / Twilio) by implementing send() against it.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phoneNumber: string, code: string, ttlSeconds: number): Promise<void> {
    const provider = process.env.SMS_PROVIDER;

    if (!provider) {
      if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('簡訊服務尚未配置');
      this.logger.log(`[SMS MOCK] To ${maskPhone(phoneNumber)} OTP=${code} (expires in ${ttlSeconds}s)`);
      return;
    }

    this.logger.error(`SMS_PROVIDER "${provider}" 尚未實作`);
    throw new ServiceUnavailableException('簡訊服務尚未完成串接');
  }
}

function maskPhone(phoneNumber: string): string {
  return `${phoneNumber.slice(0, 4)}****${phoneNumber.slice(-2)}`;
}
