import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Enum for update states
 */
export enum UpdateState {
  UP_TO_DATE = 'up_to_date',
  AVAILABLE = 'available',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * UpdateStatus entity
 *
 * Tracks the current update status for the on-premise installation.
 * Only one record should exist (singleton pattern).
 */
@Entity('update_status')
export class UpdateStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  currentVersion: string;

  @Column({ nullable: true })
  availableVersion: string;

  @Column({
    type: 'enum',
    enum: UpdateState,
    default: UpdateState.UP_TO_DATE,
  })
  state: UpdateState;

  @Column({ type: 'text', nullable: true })
  changelog: string;

  @Column({ type: 'timestamp', nullable: true })
  detectedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  lastCheckAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
