import { DeploymentConfig } from './deployment.config';

/**
 * Application configuration
 *
 * Loads and validates environment variables for the application.
 * Configuration is loaded at startup and made available via ConfigService.
 *
 * Note: Deployment mode is handled by DeploymentConfig singleton.
 * Use `DeploymentConfig.isOnPremise` or `DeploymentConfig.isSaaS` instead.
 */
export default () => ({
  // Environment and server configuration
  environment: process.env.NODE_ENV || 'development',
  deploymentMode: DeploymentConfig.current,
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database configuration
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  },

  // Email configuration for local notifications
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    sender: process.env.EMAIL_SENDER,
    senderName: process.env.EMAIL_SENDER_NAME || 'Flowly',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@yourcompany.com',
  },

  // JWT and authentication configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expirationTime: parseInt(process.env.JWT_EXPIRATION || '900', 10),
    refreshExpirationTime: parseInt(process.env.REFRESH_TOKEN_EXPIRATION || '604800', 10),
  },

  // Security configuration
  security: {
    ipHashSalt: process.env.IP_HASH_SALT,
  },

  // CORS configuration
  cors: {
    cacheOriginsDuration: parseInt(process.env.ORIGINS_CACHE_DURATION || '900000', 10),
    allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(',') || [],
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // Licensing configuration (on-premise mode only)
  licensing: {
    // JWT-based licensing (new)
    token: process.env.LICENSE_TOKEN,
    publicKey: process.env.LICENSE_PUBLIC_KEY,
    coreUrl: process.env.LICENSE_CORE_URL || process.env.LICENSE_VALIDATION_URL,
    gracePeriodDays: parseInt(process.env.LICENSE_GRACE_PERIOD_DAYS || '7', 10),
    // Legacy (deprecated)
    validationUrl: process.env.LICENSE_VALIDATION_URL,
    key: process.env.LICENSE_KEY,
  },
});
