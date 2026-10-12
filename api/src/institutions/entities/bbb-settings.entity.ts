import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Institution } from './institution.entity';

@Entity('bbb_settings')
@Unique(['institutionId'])
export class BbbSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  institutionId: string;

  @ManyToOne(() => Institution, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institutionId' })
  institution: Institution;

  // Identité & Branding
  @Column({ type: 'boolean', default: true })
  displayBrandingArea: boolean;

  @Column({ type: 'text', nullable: true })
  customLogo: string;

  @Column({ type: 'boolean', default: false })
  darkTheme: boolean;

  @Column({ type: 'varchar', length: 7, default: '#0084ff' })
  webcamBorderHighlightColor: string;

  // Langue & Accessibilité
  @Column({ type: 'varchar', length: 5, default: 'en' })
  defaultLocale: string;

  @Column({ type: 'boolean', default: true })
  showAllAvailableLocales: boolean;

  @Column({ type: 'boolean', default: false })
  captionsEnabled: boolean;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  captionsDefaultPad: string;

  @Column({ type: 'varchar', length: 7, default: '#ffffff' })
  captionsFontColor: string;

  @Column({ type: 'int', default: 20 })
  captionsFontSize: number;

  // Vidéo & Audio
  @Column({ type: 'boolean', default: true })
  enableVideo: boolean;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  videoQuality: string;

  @Column({ type: 'json', nullable: true })
  kurento: {
    cameraProfiles?: Array<{
      id: string;
      name: string;
      default?: boolean;
      hidden?: boolean;
      bitrate: number;
      constraints?: {
        width?: { min?: number; ideal?: number } | number;
        height?: { min?: number; ideal?: number } | number;
        aspectRatio?: { ideal?: number };
        frameRate?: number;
      };
    }>;
    defaultCameraProfile?: string;
    screenshare?: {
      constraints?: {
        video?: {
          frameRate?: {
            ideal?: number;
            max?: number;
          };
        };
      };
      pagination?: boolean;
    };
  };

  @Column({ type: 'boolean', default: true })
  enableScreensharing: boolean;

  @Column({ type: 'int', default: 1200 })
  screenshareBitrate: number;

  @Column({ type: 'boolean', default: false })
  virtualBackgroundsEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  enableVirtualBackgroundUpload: boolean;

  // Chat & Interactions
  @Column({ type: 'boolean', default: true })
  chatEnabled: boolean;

  @Column({ type: 'int', default: 100 })
  chatItemsPerPage: number;

  @Column({ type: 'boolean', default: true })
  userReactionEnabled: boolean;

  @Column({ type: 'json', default: () => '\'["👍", "👎", "👏", "😂", "😮", "😕"]\'' })
  userReactionList: string[];

  @Column({ type: 'boolean', default: false })
  emojiRainEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  chatTypingIndicatorEnabled: boolean;

  // Outils Collaboratifs
  @Column({ type: 'boolean', default: true })
  whiteboardEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  notesEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  presentationDownloadEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  presentationSnapshotEnabled: boolean;

  // Réunions & Sessions
  @Column({ type: 'boolean', default: true })
  timerEnabled: boolean;

  @Column({ type: 'int', default: 300 })
  timerDefaultTime: number;

  @Column({ type: 'boolean', default: true })
  pollEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  pollCustomResponseEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  breakoutRoomsEnabled: boolean;

  @Column({ type: 'int', default: 8 })
  breakoutRoomLimit: number;

  // Performance & Réseau
  @Column({ type: 'boolean', default: false })
  enableNetworkStats: boolean;

  @Column({ type: 'boolean', default: false })
  enableCopyNetworkStatsButton: boolean;

  @Column({ type: 'boolean', default: false })
  mediaForceRelay: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
