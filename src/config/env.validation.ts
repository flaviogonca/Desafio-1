const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** Fail fast at startup: a missing or weak secret must never reach production silently. */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  for (const key of REQUIRED) {
    if (!config[key] || typeof config[key] !== 'string') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  if ((config.JWT_SECRET as string).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return config;
}
