import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Enum for update results
 */
export enum UpdateResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * Backup information interface
 */
export interface BackupInfo {
  path: string;
  size: number;
  dbDumpPath: string;
  createdAt: Date;
}

/**
 * UpdateHistory entity
 *
 * Records all update attempts for audit and rollback purposes.
 */
@Entity('update_history')
export class UpdateHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromVersion: string;

  @Column()
  toVersion: string;

  @Column({
    type: 'enum',
    enum: UpdateResult,
  })
  result: UpdateResult;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'integer', nullable: true })
  durationSeconds: number;

  @Column({ type: 'text', nullable: true })
  logs: string;

  @Column({ nullable: true })
  triggeredBy: string;

  @Column({ default: 'dashboard' })
  triggerSource: string;

  @Column({ type: 'jsonb', nullable: true })
  backupInfo: BackupInfo;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  changelog: string;

  @CreateDateColumn()
  createdAt: Date;
}
