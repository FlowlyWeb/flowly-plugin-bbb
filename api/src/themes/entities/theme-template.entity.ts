import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Institution } from '../../institutions/entities/institution.entity';

/**
 * Represents a theme template that institutions can browse and apply.
 *
 * Each template stores complete styling configuration (company colors, background,
 * module colors) without logo/favicon — those are preserved from the institution's
 * current style when a theme is applied.
 *
 * Predefined themes have `institutionId = null` and are visible to all institutions.
 * Custom themes have an `institutionId` set and are only visible to their owner.
 */
@Entity('theme_templates')
export class ThemeTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owning institution for custom themes; null for predefined (global) themes. */
  @Column({ type: 'uuid', nullable: true })
  institutionId: string | null;

  @ManyToOne(() => Institution, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'institutionId' })
  institution: Institution;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', default: 'predefined' })
  category: string;

  @Column('jsonb')
  company: {
    primaryColor: string;
    background: {
      type: 'solid' | 'gradient';
      color?: string;
      gradient?: {
        color1: string;
        color2: string;
        direction:
          | 'to-top'
          | 'to-right'
          | 'to-bottom'
          | 'to-left'
          | 'to-top-right'
          | 'to-top-left'
          | 'to-bottom-right'
          | 'to-bottom-left';
      };
    };
  };

  @Column('jsonb')
  questions: {
    mainColor: string;
    backgroundColor: string;
    badge: { iconName: string; color: string } | null;
    keyword: string;
    isEnabled: boolean;
  };

  @Column('jsonb')
  mentions: {
    mainColor: string;
    backgroundColor: string;
    isEnabled: boolean;
  };

  @Column('jsonb')
  moderator: {
    mainColor: string;
    backgroundColor: string;
    badge: { iconName: string; color: string } | null;
    isEnabled: boolean;
  };

  @Column('jsonb', { default: { isEnabled: true } })
  gif: { isEnabled: boolean };

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
