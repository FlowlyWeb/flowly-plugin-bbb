import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Institution } from './institution.entity';
import { Style } from './style.entity';

/**
 * Workspace entity represents a sub-organization within an institution
 * that can have its own custom styling (logo, colors, modules).
 *
 * Examples: academies, regions, campuses, subsidiaries, departments
 */
@Entity('workspaces')
@Unique(['code', 'institutionId'])
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Display name of the workspace
   * Example: "Académie de Bretagne", "Campus Paris", "Regional Office East"
   */
  @Column()
  name: string;

  /**
   * Code used to identify the workspace in BBB meeting creation.
   * Unique per institution (composite unique constraint with institutionId).
   * This code is passed to BBB via the plugin_FlowlyPlugin_workspace parameter,
   * which BBB substitutes into the plugin script URL (?workspace=<code>).
   * Example: "ACAD_BRETAGNE", "CAMPUS_PARIS", "REGION_EAST"
   */
  @Column()
  code: string;

  /**
   * Optional description of the workspace
   */
  @Column({ nullable: true, type: 'text' })
  description: string;

  /**
   * Parent institution that owns this workspace
   */
  @ManyToOne(() => Institution, (institution) => institution.workspaces, {
    onDelete: 'CASCADE',
  })
  institution: Institution;

  @Column()
  institutionId: string;

  /**
   * Custom style for this workspace
   * If null, falls back to institution's defaultStyle
   */
  @OneToOne(() => Style, (style) => style.workspace, {
    cascade: true,
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn()
  style: Style;

  /**
   * Whether this workspace is active and can be used
   */
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
