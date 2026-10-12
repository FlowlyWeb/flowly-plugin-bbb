import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * JWT License payload structure (must match flowly-core)
 */
export interface JwtLicensePayload {
  /** Issuer - always "flowly-core" */
  iss: string;
  /** Subject - license UUID */
  sub: string;
  /** Issued at timestamp (seconds) */
  iat: number;
  /** Expiration timestamp (seconds) */
  exp: number;
  /** JWT ID - unique token identifier for revocation */
  jti: string;
  /** Flowly client ID */
  flo_client_id: string;
  /** Flowly client name */
  flo_client_name: string;
  /** Flowly license limits */
  flo_limits: {
    max_servers?: number;
    max_users?: number;
  };
  /** Payload version */
  flo_version: number;
}

/**
 * JWT header structure
 */
interface JwtHeader {
  alg: string;
  typ: string;
  kid: string;
}

/**
 * License verification result
 */
export interface LicenseVerificationResult {
  valid: boolean;
  payload?: JwtLicensePayload;
  error?: string;
  isExpired?: boolean;
}

/**
 * License Verifier Service
 *
 * Provides local (offline) JWT license token verification using
 * the embedded public key. No network calls required.
 *
 * Security:
 * - Validates RS256 signature using public key
 * - Checks token expiration
 * - Validates issuer claim
 */
@Injectable()
export class LicenseVerifierService {
  private readonly logger = new Logger(LicenseVerifierService.name);
  private readonly ISSUER = 'flowly-core';
  private readonly ALGORITHM = 'RS256';

  private publicKey: string | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const publicKeyConfig = this.configService.get<string>('LICENSE_PUBLIC_KEY');

    if (!publicKeyConfig) {
      this.logger.warn('LICENSE_PUBLIC_KEY not configured - JWT license verification disabled');
      return;
    }

    // Handle escaped newlines in environment variable
    this.publicKey = publicKeyConfig.replace(/\\n/g, '\n');
    this.isConfigured = true;

    this.logger.log('License verifier initialized with public key');
  }

  /**
   * Check if the verifier is properly configured
   */
  isReady(): boolean {
    return this.isConfigured && this.publicKey !== null;
  }

  /**
   * Verify a JWT license token locally
   *
   * Performs offline verification using the embedded public key.
   * Does not check for revocation (that requires check-in).
   *
   * @param token - The JWT token to verify
   * @returns Verification result with payload if valid
   */
  verifyToken(token: string): LicenseVerificationResult {
    if (!this.isReady()) {
      return {
        valid: false,
        error: 'License verifier not configured',
      };
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Decode and validate header
      const header: JwtHeader = JSON.parse(this.base64UrlDecode(encodedHeader));
      if (header.alg !== this.ALGORITHM) {
        return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
      }

      // Verify signature
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const signature = Buffer.from(
        encodedSignature.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      );

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signingInput);

      if (!verify.verify(this.publicKey!, signature)) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Decode payload
      const payload: JwtLicensePayload = JSON.parse(this.base64UrlDecode(encodedPayload));

      // Validate issuer
      if (payload.iss !== this.ISSUER) {
        return { valid: false, error: `Invalid issuer: ${payload.iss}` };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < now;

      if (isExpired) {
        return {
          valid: true,
          payload,
          isExpired: true,
          error: 'Token has expired',
        };
      }

      return {
        valid: true,
        payload,
        isExpired: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token verification failed: ${message}`);
      return { valid: false, error: message };
    }
  }

  /**
   * Extract payload from token without verification
   *
   * Use with caution - this does not validate the signature.
   * Useful for getting token info for logging/debugging.
   *
   * @param token - The JWT token
   * @returns Decoded payload or null if invalid format
   */
  extractPayloadUnsafe(token: string): JwtLicensePayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      return JSON.parse(this.base64UrlDecode(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Get expiration date from token
   *
   * @param token - The JWT token
   * @returns Expiration date or null if invalid
   */
  getExpirationDate(token: string): Date | null {
    const payload = this.extractPayloadUnsafe(token);
    if (!payload) return null;
    return new Date(payload.exp * 1000);
  }

  /**
   * Base64Url decode
   */
  private base64UrlDecode(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(base64 + padding, 'base64').toString('utf8');
  }
}
