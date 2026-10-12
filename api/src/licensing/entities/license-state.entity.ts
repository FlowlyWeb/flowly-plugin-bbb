import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * License state enum
 */
export enum LocalLicenseStatus {
  /** License is valid and active */
  ACTIVE = 'active',
  /** License has expired but system continues to function */
  EXPIRED = 'expired',
  /** License was revoked by flowly-core */
  REVOKED = 'revoked',
  /** In grace period (check-in failed but within grace period) */
  GRACE_PERIOD = 'grace_period',
  /** Grace period exceeded, system should warn user */
  OFFLINE_WARNING = 'offline_warning',
}

/**
 * License state entity
 *
 * Stores the local state of the license for offline operation.
 * Updated during check-ins with flowly-core.
 *
 * Only one row should exist in this table (singleton pattern).
 */
@Entity('license_state')
export class LicenseState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The JWT license token
   */
  @Column({ type: 'text' })
  jwtToken: string;

  /**
   * JWT Token ID for tracking
   */
  @Column({ type: 'varchar' })
  jti: string;

  /**
   * Current license status
   */
  @Column({
    type: 'enum',
    enum: LocalLicenseStatus,
    default: LocalLicenseStatus.ACTIVE,
  })
  status: LocalLicenseStatus;

  /**
   * License expiry date (from JWT)
   */
  @Column({ type: 'timestamp' })
  expiryDate: Date;

  /**
   * License limits
   */
  @Column({ type: 'jsonb', nullable: true })
  limits: {
    maxServers?: number;
    maxUsers?: number;
  } | null;

  /**
   * Client ID (from JWT)
   */
  @Column({ type: 'varchar', nullable: true })
  clientId: string | null;

  /**
   * Client name (from JWT)
   */
  @Column({ type: 'varchar', nullable: true })
  clientName: string | null;

  /**
   * Last successful check-in with flowly-core
   */
  @Column({ type: 'timestamp', nullable: true })
  lastCheckIn: Date | null;

  /**
   * Last check-in attempt (success or failure)
   */
  @Column({ type: 'timestamp', nullable: true })
  lastCheckInAttempt: Date | null;

  /**
   * Number of consecutive check-in failures
   */
  @Column({ type: 'int', default: 0 })
  consecutiveFailures: number;

  /**
   * Last error message from check-in (if failed)
   */
  @Column({ type: 'text', nullable: true })
  lastCheckInError: string | null;

  /**
   * Grace period start date (when check-ins started failing)
   */
  @Column({ type: 'timestamp', nullable: true })
  gracePeriodStart: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
