import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeploymentConfig } from '../config/deployment.config';
import { LicenseVerifierService } from './license-verifier.service';
import { CheckInService } from './check-in.service';
import { LicenseState, LocalLicenseStatus } from './entities/license-state.entity';

/**
 * License validation response
 *
 * Provides a consistent interface for license status across the application.
 */
export interface LicenseValidation {
  valid: boolean;
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'grace_period' | 'offline_warning';
  expiryDate: Date;
  limits: {
    maxServers?: number;
    maxUsers?: number;
  };
  message: string;
  /** True if we're in offline grace period */
  inGracePeriod?: boolean;
  /** Remaining days in grace period */
  gracePeriodDaysRemaining?: number;
}

/**
 * Licensing service for flowly-api (on-premise)
 *
 * Provides 100% offline license validation using JWT tokens.
 * Optionally checks in with flowly-core for:
 * - Revocation checks
 * - Usage analytics
 * - Token refresh
 *
 * Responsibilities:
 * - Validate JWT license token locally (no network required)
 * - Initialize license state on first startup
 * - Provide license status to other modules
 * - Handle grace period for offline operation
 */
@Injectable()
export class LicensingService implements OnModuleInit {
  private readonly logger = new Logger(LicensingService.name);

  constructor(
    @InjectRepository(LicenseState)
    private licenseStateRepository: Repository<LicenseState>,
    private readonly configService: ConfigService,
    private readonly verifierService: LicenseVerifierService,
    private readonly checkInService: CheckInService,
  ) {}

  /**
   * Initialize license on application startup
   *
   * For on-premise deployments:
   * 1. Check if LICENSE_TOKEN is configured
   * 2. Verify token signature locally
   * 3. Initialize or update license state
   */
  async onModuleInit(): Promise<void> {
    if (!DeploymentConfig.isOnPremise) {
      this.logger.log('Skipping license initialization (SaaS deployment)');
      return;
    }

    this.logger.log('Initializing license system...');

    // Check for JWT token configuration
    const token = this.configService.get<string>('LICENSE_TOKEN');

    if (!token) {
      this.logger.warn('LICENSE_TOKEN not configured - license features disabled');
      return;
    }

    // Verify the token locally
    if (!this.verifierService.isReady()) {
      this.logger.error('License verifier not ready - check LICENSE_PUBLIC_KEY configuration');
      return;
    }

    const verification = this.verifierService.verifyToken(token);
    if (!verification.valid || !verification.payload) {
      this.logger.error(`Invalid LICENSE_TOKEN: ${verification.error || 'Unknown error'}`);
      return;
    }

    // Check if we need to initialize state
    const existingState = await this.checkInService.getLicenseState();

    if (!existingState || existingState.jti !== verification.payload.jti) {
      // Initialize or update license state
      this.logger.log('Initializing license state from token...');
      await this.checkInService.initializeLicenseState(token);
    }

    // Log license info
    const state = await this.checkInService.getLicenseState();
    if (state) {
      this.logger.log(
        `License initialized: ${state.clientName || 'Unknown'} ` +
          `(expires: ${state.expiryDate.toISOString()}, status: ${state.status})`,
      );

      if (state.limits) {
        this.logger.log(
          `License limits: ${state.limits.maxServers || 'unlimited'} servers, ` +
            `${state.limits.maxUsers || 'unlimited'} users`,
        );
      }
    }
  }

  /**
   * Validate license (local validation)
   *
   * Performs offline validation using cached state and JWT verification.
   * Does not make network calls - use checkInService for that.
   *
   * @returns License validation result
   */
  async validateLicense(): Promise<LicenseValidation> {
    if (!DeploymentConfig.isOnPremise) {
      return {
        valid: true,
        status: 'active',
        expiryDate: new Date('2099-12-31'),
        limits: {},
        message: 'SaaS deployment - no license required',
      };
    }

    const state = await this.checkInService.getLicenseState();

    if (!state) {
      return {
        valid: false,
        status: 'revoked',
        expiryDate: new Date(),
        limits: {},
        message: 'No license configured - please set LICENSE_TOKEN',
      };
    }

    // Verify the current token
    const verification = this.verifierService.verifyToken(state.jwtToken);
    if (!verification.valid) {
      return {
        valid: false,
        status: 'revoked',
        expiryDate: state.expiryDate,
        limits: state.limits || {},
        message: `Invalid license token: ${verification.error}`,
      };
    }

    // Check state status
    switch (state.status) {
      case LocalLicenseStatus.REVOKED:
        return {
          valid: false,
          status: 'revoked',
          expiryDate: state.expiryDate,
          limits: state.limits || {},
          message: 'License has been revoked',
        };

      case LocalLicenseStatus.EXPIRED:
        return {
          valid: true, // Expired but still functional
          status: 'expired',
          expiryDate: state.expiryDate,
          limits: state.limits || {},
          message: 'License expired - updates blocked but system continues to function',
        };

      case LocalLicenseStatus.GRACE_PERIOD:
      case LocalLicenseStatus.OFFLINE_WARNING: {
        const remaining = await this.checkInService.getRemainingGracePeriodDays();
        return {
          valid: true,
          status:
            state.status === LocalLicenseStatus.GRACE_PERIOD ? 'grace_period' : 'offline_warning',
          expiryDate: state.expiryDate,
          limits: state.limits || {},
          message:
            state.status === LocalLicenseStatus.GRACE_PERIOD
              ? `Unable to verify license - grace period active (${remaining} days remaining)`
              : 'Grace period exceeded - please contact support',
          inGracePeriod: true,
          gracePeriodDaysRemaining: remaining || 0,
        };
      }

      case LocalLicenseStatus.ACTIVE:
      default:
        return {
          valid: true,
          status: 'active',
          expiryDate: state.expiryDate,
          limits: state.limits || {},
          message: 'License is valid',
        };
    }
  }

  /**
   * Get current license status (cached, no validation)
   *
   * @returns Cached license state or null
   */
  async getLicenseStatus(): Promise<LicenseValidation | null> {
    const state = await this.checkInService.getLicenseState();
    if (!state) return null;

    return {
      valid: state.status !== LocalLicenseStatus.REVOKED,
      status: state.status as LicenseValidation['status'],
      expiryDate: state.expiryDate,
      limits: state.limits || {},
      message: `Status: ${state.status}`,
    };
  }

  /**
   * Check if license is currently valid
   *
   * @returns true if license allows normal operation
   */
  async isLicenseValid(): Promise<boolean> {
    const validation = await this.validateLicense();
    return validation.valid;
  }

  /**
   * Check if license allows specific limits
   *
   * @param servers - Number of servers to check
   * @param users - Number of users to check
   * @returns true if within limits
   */
  async checkLimits(servers?: number, users?: number): Promise<boolean> {
    const state = await this.checkInService.getLicenseState();
    if (!state) return false;

    if (servers && state.limits?.maxServers) {
      if (servers > state.limits.maxServers) return false;
    }

    if (users && state.limits?.maxUsers) {
      if (users > state.limits.maxUsers) return false;
    }

    return true;
  }

  /**
   * Get license limits
   *
   * @returns License limits or null if not configured
   */
  async getLimits(): Promise<{ maxServers?: number; maxUsers?: number } | null> {
    const state = await this.checkInService.getLicenseState();
    return state?.limits || null;
  }

  /**
   * Get client information from license
   *
   * @returns Client info or null
   */
  async getClientInfo(): Promise<{ id: string; name: string } | null> {
    const state = await this.checkInService.getLicenseState();
    if (!state?.clientId) return null;

    return {
      id: state.clientId,
      name: state.clientName || 'Unknown',
    };
  }
}
