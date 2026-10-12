import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Style } from './style.entity';
import { User } from '../../user/entities/user.entity';
import { Workspace } from './workspace.entity';

/**
 * License status for on-premise installations
 */
export enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
}

/**
 * Pricing tier enumeration (mirrors flowly-core)
 */
export enum PricingTier {
  DISCOVERY = 'discovery',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

/**
 * Institution entity (source of truth)
 *
 * Represents an institution/organization.
 * In on-premise mode: 1 institution per installation
 * In SaaS mode: Multiple institutions (multi-tenant)
 */
@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  domain: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['france', 'eu', 'world'],
    default: 'france',
  })
  geoRegion: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  vatNumber: string;

  @Column({ default: true })
  isActive: boolean;

  // Licensing fields (on-premise only)
  @Column({ nullable: true })
  licenseKey: string;

  @Column({ type: 'timestamp', nullable: true })
  licenseCachedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  licenseCachedData: {
    status: LicenseStatus;
    expiryDate: Date;
    limits: {
      maxServers?: number;
      maxUsers?: number;
    };
  };

  // SaaS pricing fields
  @Column({
    type: 'enum',
    enum: PricingTier,
    default: PricingTier.DISCOVERY,
  })
  currentPricingTier: PricingTier; // Current pricing tier

  @Column({ default: 0 })
  quotaServersUsed: number; // Number of active servers

  @Column({ default: 1 })
  quotaServerLimit: number; // Max servers from current plan

  @Column({ default: 0 })
  quotaSubOrgsUsed: number; // Number of active sub-organizations

  @Column({ default: 0 })
  quotaSubOrgLimit: number; // Max sub-orgs from current plan

  // Relations
  /**
   * Default style for this institution
   * Used when no workspace is specified or workspace has no custom style
   */
  @OneToOne(() => Style, (style) => style.institution, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  defaultStyle: Style;

  /**
   * Workspaces (sub-organizations) belonging to this institution
   * Each workspace can have its own custom style
   */
  @OneToMany(() => Workspace, (workspace) => workspace.institution, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  workspaces: Workspace[];

  @OneToMany(() => User, (user) => user.institution, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
