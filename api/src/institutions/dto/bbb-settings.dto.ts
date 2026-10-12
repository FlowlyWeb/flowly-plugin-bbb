import {
  IsBoolean,
  IsString,
  IsInt,
  IsArray,
  IsOptional,
  IsHexColor,
  Length,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CameraProfileDto {
  @ApiProperty({ description: 'Identifiant unique du profil' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Nom du profil' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Profil par défaut' })
  @IsOptional()
  @IsBoolean()
  default?: boolean;

  @ApiPropertyOptional({ description: "Profil caché dans l'interface" })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiProperty({ description: 'Débit en kbps' })
  @IsInt()
  @Min(10)
  @Max(5000)
  bitrate: number;

  @ApiPropertyOptional({ description: 'Contraintes vidéo' })
  @IsOptional()
  @IsObject()
  constraints?: {
    width?: { min?: number; ideal?: number } | number;
    height?: { min?: number; ideal?: number } | number;
    aspectRatio?: { ideal?: number };
    frameRate?: number;
  };
}

export class ScreenshareSettingsDto {
  @ApiPropertyOptional({ description: "Contraintes vidéo pour le partage d'écran" })
  @IsOptional()
  @IsObject()
  constraints?: {
    video?: {
      frameRate?: {
        ideal?: number;
        max?: number;
      };
    };
  };

  @ApiPropertyOptional({ description: 'Pagination activée' })
  @IsOptional()
  @IsBoolean()
  pagination?: boolean;
}

export class KurentoSettingsDto {
  @ApiPropertyOptional({ description: 'Profils caméra personnalisés', type: [CameraProfileDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CameraProfileDto)
  cameraProfiles?: CameraProfileDto[];

  @ApiPropertyOptional({ description: 'Profil caméra par défaut' })
  @IsOptional()
  @IsString()
  defaultCameraProfile?: string;

  @ApiPropertyOptional({
    description: "Paramètres de partage d'écran",
    type: ScreenshareSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScreenshareSettingsDto)
  screenshare?: ScreenshareSettingsDto;
}

export class CreateBbbSettingsDto {
  // Identité & Branding
  @ApiPropertyOptional({ description: 'Afficher zone de branding' })
  @IsOptional()
  @IsBoolean()
  displayBrandingArea?: boolean;

  @ApiPropertyOptional({ description: 'Logo personnalisé (URL ou base64)' })
  @IsOptional()
  @IsString()
  customLogo?: string;

  @ApiPropertyOptional({ description: 'Thème sombre activé' })
  @IsOptional()
  @IsBoolean()
  darkTheme?: boolean;

  @ApiPropertyOptional({ description: 'Couleur surbrillance webcams' })
  @IsOptional()
  @IsHexColor()
  webcamBorderHighlightColor?: string;

  // Langue & Accessibilité
  @ApiPropertyOptional({ description: 'Langue par défaut', example: 'fr' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  defaultLocale?: string;

  @ApiPropertyOptional({ description: 'Afficher toutes les langues disponibles' })
  @IsOptional()
  @IsBoolean()
  showAllAvailableLocales?: boolean;

  @ApiPropertyOptional({ description: 'Sous-titres activés' })
  @IsOptional()
  @IsBoolean()
  captionsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Langue par défaut des sous-titres' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  captionsDefaultPad?: string;

  @ApiPropertyOptional({ description: 'Couleur du texte des sous-titres' })
  @IsOptional()
  @IsHexColor()
  captionsFontColor?: string;

  @ApiPropertyOptional({ description: 'Taille du texte des sous-titres' })
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(48)
  captionsFontSize?: number;

  // Vidéo & Audio
  @ApiPropertyOptional({ description: 'Webcams activées' })
  @IsOptional()
  @IsBoolean()
  enableVideo?: boolean;

  @ApiPropertyOptional({ description: 'Qualité vidéo par défaut' })
  @IsOptional()
  @IsString()
  videoQuality?: string;

  @ApiPropertyOptional({ description: "Partage d'écran activé" })
  @IsOptional()
  @IsBoolean()
  enableScreensharing?: boolean;

  @ApiPropertyOptional({ description: "Débit partage d'écran (kbps)" })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  screenshareBitrate?: number;

  @ApiPropertyOptional({ description: 'Fonds virtuels activés' })
  @IsOptional()
  @IsBoolean()
  virtualBackgroundsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Upload de fonds virtuels autorisé' })
  @IsOptional()
  @IsBoolean()
  enableVirtualBackgroundUpload?: boolean;

  @ApiPropertyOptional({ description: 'Configuration Kurento avancée', type: KurentoSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => KurentoSettingsDto)
  kurento?: KurentoSettingsDto;

  // Chat & Interactions
  @ApiPropertyOptional({ description: 'Chat activé' })
  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Messages maximum affichés dans le chat' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  chatItemsPerPage?: number;

  @ApiPropertyOptional({ description: 'Réactions emoji activées' })
  @IsOptional()
  @IsBoolean()
  userReactionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Liste des réactions disponibles' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userReactionList?: string[];

  @ApiPropertyOptional({ description: "Pluie d'emoji activée" })
  @IsOptional()
  @IsBoolean()
  emojiRainEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Indicateur de saisie dans le chat' })
  @IsOptional()
  @IsBoolean()
  chatTypingIndicatorEnabled?: boolean;

  // Outils Collaboratifs
  @ApiPropertyOptional({ description: 'Tableau blanc activé' })
  @IsOptional()
  @IsBoolean()
  whiteboardEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Bloc-notes collaboratif activé' })
  @IsOptional()
  @IsBoolean()
  notesEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Téléchargement de présentation autorisé' })
  @IsOptional()
  @IsBoolean()
  presentationDownloadEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Snapshots de diapositives autorisés' })
  @IsOptional()
  @IsBoolean()
  presentationSnapshotEnabled?: boolean;

  // Réunions & Sessions
  @ApiPropertyOptional({ description: 'Minuterie activée' })
  @IsOptional()
  @IsBoolean()
  timerEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Durée par défaut de la minuterie (secondes)' })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(7200)
  timerDefaultTime?: number;

  @ApiPropertyOptional({ description: 'Sondages activés' })
  @IsOptional()
  @IsBoolean()
  pollEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Réponses personnalisées dans les sondages' })
  @IsOptional()
  @IsBoolean()
  pollCustomResponseEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Breakout rooms activées' })
  @IsOptional()
  @IsBoolean()
  breakoutRoomsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Nombre maximum de breakout rooms' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  breakoutRoomLimit?: number;

  // Performance & Réseau
  @ApiPropertyOptional({ description: 'Afficher les statistiques réseau' })
  @IsOptional()
  @IsBoolean()
  enableNetworkStats?: boolean;

  @ApiPropertyOptional({ description: 'Bouton copier les stats réseau' })
  @IsOptional()
  @IsBoolean()
  enableCopyNetworkStatsButton?: boolean;

  @ApiPropertyOptional({ description: 'Forcer le relay média' })
  @IsOptional()
  @IsBoolean()
  mediaForceRelay?: boolean;
}

export class UpdateBbbSettingsDto extends CreateBbbSettingsDto {}

export class BbbSettingsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  institutionId: string;

  // Identité & Branding
  @ApiProperty()
  displayBrandingArea: boolean;

  @ApiPropertyOptional()
  customLogo?: string;

  @ApiProperty()
  darkTheme: boolean;

  @ApiProperty()
  webcamBorderHighlightColor: string;

  // Langue & Accessibilité
  @ApiProperty()
  defaultLocale: string;

  @ApiProperty()
  showAllAvailableLocales: boolean;

  @ApiProperty()
  captionsEnabled: boolean;

  @ApiProperty()
  captionsDefaultPad: string;

  @ApiProperty()
  captionsFontColor: string;

  @ApiProperty()
  captionsFontSize: number;

  // Vidéo & Audio
  @ApiProperty()
  enableVideo: boolean;

  @ApiProperty()
  videoQuality: string;

  @ApiProperty()
  enableScreensharing: boolean;

  @ApiProperty()
  screenshareBitrate: number;

  @ApiProperty()
  virtualBackgroundsEnabled: boolean;

  @ApiProperty()
  enableVirtualBackgroundUpload: boolean;

  @ApiPropertyOptional({ description: 'Configuration Kurento avancée', type: KurentoSettingsDto })
  kurento?: KurentoSettingsDto;

  // Chat & Interactions
  @ApiProperty()
  chatEnabled: boolean;

  @ApiProperty()
  chatItemsPerPage: number;

  @ApiProperty()
  userReactionEnabled: boolean;

  @ApiProperty()
  userReactionList: string[];

  @ApiProperty()
  emojiRainEnabled: boolean;

  @ApiProperty()
  chatTypingIndicatorEnabled: boolean;

  // Outils Collaboratifs
  @ApiProperty()
  whiteboardEnabled: boolean;

  @ApiProperty()
  notesEnabled: boolean;

  @ApiProperty()
  presentationDownloadEnabled: boolean;

  @ApiProperty()
  presentationSnapshotEnabled: boolean;

  // Réunions & Sessions
  @ApiProperty()
  timerEnabled: boolean;

  @ApiProperty()
  timerDefaultTime: number;

  @ApiProperty()
  pollEnabled: boolean;

  @ApiProperty()
  pollCustomResponseEnabled: boolean;

  @ApiProperty()
  breakoutRoomsEnabled: boolean;

  @ApiProperty()
  breakoutRoomLimit: number;

  // Performance & Réseau
  @ApiProperty()
  enableNetworkStats: boolean;

  @ApiProperty()
  enableCopyNetworkStatsButton: boolean;

  @ApiProperty()
  mediaForceRelay: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
