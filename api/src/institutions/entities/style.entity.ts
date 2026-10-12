import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Institution } from './institution.entity';
import { Workspace } from './workspace.entity';

/**
 * Style entity represents customization settings (colors, logos, modules)
 * A style can belong to either:
 * - An Institution (as defaultStyle) - used when no workspace is specified
 * - A Workspace (as workspace-specific style) - used when workspaceCode is provided
 *
 * Only one of institution or workspace should be set (mutually exclusive)
 */
@Entity('styles')
export class Style {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb')
  company: {
    primaryColor: string;
    background: {
      type: 'solid' | 'gradient' | 'image';
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
      image?: {
        data: string;
        size: 'cover' | 'contain' | 'repeat';
        position:
          | 'center'
          | 'top'
          | 'bottom'
          | 'left'
          | 'right'
          | 'top-left'
          | 'top-right'
          | 'bottom-left'
          | 'bottom-right';
      };
    };
    logo: string | null;
    favicon: string | null;
  };

  @Column('jsonb')
  questions: {
    mainColor: string;
    backgroundColor: string;
    badge: {
      iconName: string;
      color: string;
    } | null;
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
    badge: {
      iconName: string;
      color: string;
    } | null;
    isEnabled: boolean;
  };

  @Column('jsonb', { default: { isEnabled: true } })
  gif: {
    isEnabled: boolean;
  };

  @Column('jsonb', { default: { isEnabled: true } })
  usernames: {
    isEnabled: boolean;
  };

  /**
   * ID of the theme template currently applied to this style.
   * Set when a theme is applied via the library, cleared (null) when
   * the style is manually modified (colors, modules, reset).
   * Logo/favicon changes do NOT clear this field.
   */
  @Column({ type: 'uuid', nullable: true, default: null })
  appliedThemeTemplateId: string | null;

  /**
   * Institution that owns this style as its default style
   * Null if this style belongs to a workspace
   */
  @OneToOne(() => Institution, (institution) => institution.defaultStyle, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  institution: Institution | null;

  /**
   * Workspace that owns this style
   * Null if this style is an institution's default style
   */
  @OneToOne(() => Workspace, (workspace) => workspace.style, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  workspace: Workspace | null;
}
