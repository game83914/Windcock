const BLOCKED_SECRETS = new Set([
  'dev-secret',
  'change-me-in-production',
  'changeme',
  'secret',
  'password',
]);

const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * 簽發與驗證共用的 JWT secret 解析。
 * Production 採 fail-closed：缺失、公開預設值或過短一律拒絕啟動，
 * 避免服務以可偽造的密鑰上線。非 production 允許開發預設值。
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    return 'dev-secret';
  }
  if (env.NODE_ENV === 'production') {
    if (BLOCKED_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET uses a publicly known default; set a high-entropy random value');
    }
    if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
      );
    }
  }
  return secret;
}
