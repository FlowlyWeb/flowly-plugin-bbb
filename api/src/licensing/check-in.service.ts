import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosInstance } from 'axios';
import { LicenseState, LocalLicenseStatus } from './entities/license-state.entity';
import { LicenseVerifierService } from './license-verifier.service';
import { DeploymentConfig } from '../config/deployment.config';

/**
 * Check-in response from flowly-core
 */
interface CheckInResponse {
  revoked: boolean;
  status: string;
  newToken?: string;
  message?: string;
  expiryDate: string;
  limits: {
    maxServers?: number;
    maxUsers?: number;
  };
}

/**
 * Check-in Service
 *
 * Handles periodic check-ins with flowly-core to:
 * - Verify license hasn't been revoked
 * - Report usage statistics
 * - Optionally receive updated tokens
 *
 * Implements grace period logic for offline operation.
 */
@Injectable()
export class CheckInService implements OnModuleInit {
  private readonly logger = new Logger(CheckInService.name);
  private readonly httpClient: AxiosInstance;
  private readonly gracePeriodDays: number;
  private readonly coreUrl: string;

  constructor(
    @InjectRepository(LicenseState)
    private licenseStateRepository: Repository<LicenseState>,
    private readonly configService: ConfigService,
    private readonly verifierService: LicenseVerifierService,
  ) {
    this.coreUrl =
      this.configService.get<string>('LICENSE_CORE_URL') ||
      this.configService.get<string>('LICENSE_VALIDATION_URL') ||
      'http://localhost:3001';

    this.gracePeriodDays = parseInt(
      this.configService.get<string>('LICENSE_GRACE_PERIOD_DAYS') || '7',
      10,
    );

    this.httpClient = axios.create({
      baseURL: this.coreUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Perform initial check-in on startup
   */
  async onModuleInit(): Promise<void> {
    if (!DeploymentConfig.isOnPremise) {
      return;
    }

    // Run first check-in after a short delay to allow app to fully start
    setTimeout(() => this.performCheckIn(), 5000);
  }

  /**
   * Scheduled check-in every 24 hours
   *
   * Runs at 3:00 AM daily to minimize impact on users.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledCheckIn(): Promise<void> {
    if (!DeploymentConfig.isOnPremise) {
      return;
    }

    this.logger.log('Running scheduled license check-in...');
    await this.performCheckIn();
  }

  /**
   * Perform a check-in with flowly-core
   *
   * @param stats - Optional usage statistics to report
   * @returns Check-in result
   */
  async performCheckIn(stats?: { servers?: number; users?: number; version?: string }): Promise<{
    success: boolean;
    revoked: boolean;
    message: string;
  }> {
    const state = await this.getLicenseState();
    if (!state) {
      return {
        success: false,
        revoked: false,
        message: 'No license configured',
      };
    }

    this.logger.log('Performing license check-in...');

    try {
      const response = await this.httpClient.post<CheckInResponse>(
        '/api/licensing/check-in',
        { stats },
        {
          headers: {
            Authorization: `Bearer ${state.jwtToken}`,
          },
        },
      );

      const result = response.data;

      // Update state based on response
      state.lastCheckIn = new Date();
      state.lastCheckInAttempt = new Date();
      state.consecutiveFailures = 0;
      state.lastCheckInError = null;
      state.gracePeriodStart = null;

      if (result.revoked) {
        state.status = LocalLicenseStatus.REVOKED;
        await this.licenseStateRepository.save(state);

        this.logger.warn(`License revoked: ${result.message}`);
        return {
          success: true,
          revoked: true,
          message: result.message || 'License has been revoked',
        };
      }

      // Update status based on response
      if (result.status === 'expired') {
        state.status = LocalLicenseStatus.EXPIRED;
      } else {
        state.status = LocalLicenseStatus.ACTIVE;
      }

      // Update limits if changed
      if (result.limits) {
        state.limits = result.limits;
      }

      // Handle token refresh if provided
      if (result.newToken) {
        state.jwtToken = result.newToken;
        const payload = this.verifierService.extractPayloadUnsafe(result.newToken);
        if (payload) {
          state.jti = payload.jti;
          state.expiryDate = new Date(payload.exp * 1000);
        }
        this.logger.log('License token refreshed');
      }

      await this.licenseStateRepository.save(state);

      this.logger.log(`Check-in successful: ${result.message}`);
      return {
        success: true,
        revoked: false,
        message: result.message || 'Check-in successful',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Check-in failed: ${errorMessage}`);

      // Update state for failed check-in
      state.lastCheckInAttempt = new Date();
      state.consecutiveFailures += 1;
      state.lastCheckInError = errorMessage;

      // Start grace period if not already started
      if (!state.gracePeriodStart) {
        state.gracePeriodStart = new Date();
        state.status = LocalLicenseStatus.GRACE_PERIOD;
        this.logger.warn(`Entering grace period (${this.gracePeriodDays} days)`);
      }

      // Check if grace period has exceeded
      const gracePeriodMs = this.gracePeriodDays * 24 * 60 * 60 * 1000;
      const gracePeriodElapsed = Date.now() - state.gracePeriodStart.getTime();

      if (gracePeriodElapsed > gracePeriodMs) {
        state.status = LocalLicenseStatus.OFFLINE_WARNING;
        this.logger.error(`Grace period exceeded - system should warn administrators`);
      }

      await this.licenseStateRepository.save(state);

      return {
        success: false,
        revoked: false,
        message: `Check-in failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get the current license state
   */
  async getLicenseState(): Promise<LicenseState | null> {
    const states = await this.licenseStateRepository.find({
      take: 1,
      order: { createdAt: 'DESC' },
    });
    return states[0] || null;
  }

  /**
   * Initialize license state from JWT token
   *
   * Called on first setup when LICENSE_TOKEN is configured.
   *
   * @param token - JWT license token
   * @returns Created license state
   */
  async initializeLicenseState(token: string): Promise<LicenseState> {
    const verification = this.verifierService.verifyToken(token);
    if (!verification.valid || !verification.payload) {
      throw new Error(`Invalid license token: ${verification.error || 'Unknown error'}`);
    }

    const payload = verification.payload;

    // Delete any existing state
    await this.licenseStateRepository.clear();

    // Create new state
    const state = this.licenseStateRepository.create({
      jwtToken: token,
      jti: payload.jti,
      status: verification.isExpired ? LocalLicenseStatus.EXPIRED : LocalLicenseStatus.ACTIVE,
      expiryDate: new Date(payload.exp * 1000),
      limits: {
        maxServers: payload.flo_limits.max_servers,
        maxUsers: payload.flo_limits.max_users,
      },
      clientId: payload.flo_client_id,
      clientName: payload.flo_client_name,
    });

    const saved = await this.licenseStateRepository.save(state);
    this.logger.log(`License state initialized for client: ${payload.flo_client_name}`);

    return saved;
  }

  /**
   * Check if we're in grace period
   */
  async isInGracePeriod(): Promise<boolean> {
    const state = await this.getLicenseState();
    return (
      state?.status === LocalLicenseStatus.GRACE_PERIOD ||
      state?.status === LocalLicenseStatus.OFFLINE_WARNING
    );
  }

  /**
   * Get remaining grace period days
   */
  async getRemainingGracePeriodDays(): Promise<number | null> {
    const state = await this.getLicenseState();
    if (!state?.gracePeriodStart) return null;

    const gracePeriodMs = this.gracePeriodDays * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - state.gracePeriodStart.getTime();
    const remaining = gracePeriodMs - elapsed;

    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }

  /**
   * Force a check-in (can be triggered manually)
   */
  async forceCheckIn(): Promise<void> {
    await this.performCheckIn();
  }
}
