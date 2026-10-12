import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BbbSettings } from '../entities/bbb-settings.entity';
import { CreateBbbSettingsDto, UpdateBbbSettingsDto } from '../dto/bbb-settings.dto';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BbbSettingsService {
  constructor(
    @InjectRepository(BbbSettings)
    private bbbSettingsRepository: Repository<BbbSettings>,
  ) {}

  async create(
    institutionId: string,
    createBbbSettingsDto: CreateBbbSettingsDto,
  ): Promise<BbbSettings> {
    // Vérifier si les paramètres réels existent déjà en base (pas les défauts)
    const existingReal = await this.bbbSettingsRepository.findOne({
      where: { institutionId },
    });

    if (existingReal) {
      // Si des paramètres réels existent, les mettre à jour
      return await this.update(institutionId, createBbbSettingsDto);
    }

    // Récupérer les paramètres par défaut pour préserver les profils caméra, etc.
    const defaultSettings = await this.getDefaultSettings();

    // Fusionner les paramètres par défaut avec les nouvelles données
    // Les nouvelles données écrasent les défauts quand elles sont définies
    const mergedSettings = {
      ...defaultSettings,
      ...createBbbSettingsDto,
      // Fusionner intelligemment les objets imbriqués comme kurento
      kurento: {
        ...defaultSettings.kurento,
        ...createBbbSettingsDto.kurento,
        // Si aucun profil caméra n'est fourni, garder ceux par défaut
        cameraProfiles:
          createBbbSettingsDto.kurento?.cameraProfiles || defaultSettings.kurento?.cameraProfiles,
      },
    };

    // Créer de nouveaux paramètres avec les valeurs fusionnées
    // institutionId is set last so that it can never be overridden by the payload
    const bbbSettings = this.bbbSettingsRepository.create({
      ...mergedSettings,
      institutionId,
    });

    return await this.bbbSettingsRepository.save(bbbSettings);
  }

  async findByInstitution(institutionId: string): Promise<BbbSettings | null> {
    const existing = await this.bbbSettingsRepository.findOne({
      where: { institutionId },
    });

    // Si aucun paramètre n'existe, retourner les paramètres par défaut
    if (!existing) {
      const defaults = await this.getDefaultSettings();
      return {
        id: 'default',
        institutionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...defaults,
      } as BbbSettings;
    }

    return existing;
  }

  async update(
    institutionId: string,
    updateBbbSettingsDto: UpdateBbbSettingsDto,
  ): Promise<BbbSettings> {
    // Vérifier si des paramètres réels existent en base (pas les défauts)
    const existingSettings = await this.bbbSettingsRepository.findOne({
      where: { institutionId },
    });

    if (!existingSettings) {
      // Si aucun paramètre n'existe en base, en créer un nouveau
      return await this.create(institutionId, updateBbbSettingsDto);
    }

    await this.bbbSettingsRepository.update({ institutionId }, updateBbbSettingsDto);

    const updatedSettings = await this.findByInstitution(institutionId);
    if (!updatedSettings) {
      throw new NotFoundException('Settings not found after update');
    }

    return updatedSettings;
  }

  async upsert(
    institutionId: string,
    data: CreateBbbSettingsDto | UpdateBbbSettingsDto,
  ): Promise<BbbSettings> {
    const existing = await this.bbbSettingsRepository.findOne({
      where: { institutionId },
    });

    if (existing) {
      return await this.update(institutionId, data);
    } else {
      return await this.create(institutionId, data as CreateBbbSettingsDto);
    }
  }

  async delete(institutionId: string): Promise<void> {
    const result = await this.bbbSettingsRepository.delete({ institutionId });

    if (result.affected === 0) {
      throw new NotFoundException('BBB Settings not found');
    }
  }

  async generateYaml(institutionId: string): Promise<string> {
    const settings = await this.findByInstitution(institutionId);

    if (!settings) {
      throw new NotFoundException('BBB Settings not found');
    }

    // Récupérer les valeurs par défaut pour comparaison
    const defaultSettings = await this.getDefaultSettings();

    // Générer uniquement les surcharges (valeurs différentes des défauts)
    const overrides = this.generateOverridesOnly(settings, defaultSettings);

    // Si aucune surcharge, retourner un commentaire explicatif
    if (Object.keys(overrides).length === 0) {
      return `# Aucune personnalisation BBB configurée
# Ce fichier sera automatiquement généré quand vous modifierez des paramètres
# dans le dashboard Flowly

# Exemple de structure:
# public:
#   defaultSettings:
#     application:
#       darkTheme: true
`;
    }

    // Ajouter un en-tête explicatif
    const header = `# Configuration BigBlueButton - Surcharges Flowly
# Ce fichier contient uniquement les paramètres modifiés par rapport aux valeurs par défaut
# Généré automatiquement le ${new Date().toLocaleString('fr-FR')}
#
# Pour appliquer cette configuration, placez ce fichier dans le répertoire de BBB
# et redémarrez les services BBB

`;

    return header + yaml.stringify(overrides);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private generateOverridesOnly(settings: BbbSettings, defaults: Partial<BbbSettings>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overrides: any = {};

    // Helper pour ajouter une propriété seulement si elle diffère du défaut
    const addIfDifferent = (
      configPath: string[],
      settingKey: keyof BbbSettings,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yamlValue?: any,
    ) => {
      const currentValue = settings[settingKey];
      const defaultValue = defaults[settingKey];

      // Ignorer si identique au défaut
      if (JSON.stringify(currentValue) === JSON.stringify(defaultValue)) {
        return;
      }

      // Créer la structure imbriquée
      let current = overrides;
      for (let i = 0; i < configPath.length - 1; i++) {
        if (!current[configPath[i]]) {
          current[configPath[i]] = {};
        }
        current = current[configPath[i]];
      }

      // Assigner la valeur (utiliser yamlValue si fourni, sinon currentValue)
      const finalPath = configPath[configPath.length - 1];
      current[finalPath] = yamlValue !== undefined ? yamlValue : currentValue;
    };

    // Initialiser la structure de base si nécessaire
    const ensurePublicStructure = () => {
      if (!overrides.public) overrides.public = {};
    };

    // === IDENTITÉ & BRANDING ===
    if (settings.displayBrandingArea !== defaults.displayBrandingArea) {
      ensurePublicStructure();
      if (!overrides.public.branding) overrides.public.branding = {};
      overrides.public.branding.displayBrandingArea = settings.displayBrandingArea;
    }

    if (settings.darkTheme !== defaults.darkTheme) {
      ensurePublicStructure();
      if (!overrides.public.defaultSettings) overrides.public.defaultSettings = {};
      if (!overrides.public.defaultSettings.application)
        overrides.public.defaultSettings.application = {};
      overrides.public.defaultSettings.application.darkTheme = settings.darkTheme;
    }

    if (settings.webcamBorderHighlightColor !== defaults.webcamBorderHighlightColor) {
      ensurePublicStructure();
      if (!overrides.public.defaultSettings) overrides.public.defaultSettings = {};
      if (!overrides.public.defaultSettings.application)
        overrides.public.defaultSettings.application = {};
      overrides.public.defaultSettings.application.webcamBorderHighlightColor = [
        settings.webcamBorderHighlightColor,
      ];
    }

    // === LANGUE & ACCESSIBILITÉ ===
    if (settings.defaultLocale !== defaults.defaultLocale) {
      ensurePublicStructure();
      if (!overrides.public.app) overrides.public.app = {};
      if (!overrides.public.app.language) overrides.public.app.language = {};
      overrides.public.app.language.locale = settings.defaultLocale;
    }

    addIfDifferent(['public', 'showAllAvailableLocales'], 'showAllAvailableLocales');

    if (
      settings.captionsEnabled !== defaults.captionsEnabled ||
      settings.captionsDefaultPad !== defaults.captionsDefaultPad ||
      settings.captionsFontColor !== defaults.captionsFontColor ||
      settings.captionsFontSize !== defaults.captionsFontSize
    ) {
      ensurePublicStructure();
      overrides.public.captions = {};

      if (settings.captionsEnabled !== defaults.captionsEnabled) {
        overrides.public.captions.enabled = settings.captionsEnabled;
      }
      if (settings.captionsDefaultPad !== defaults.captionsDefaultPad) {
        overrides.public.captions.defaultPad = settings.captionsDefaultPad;
      }
      if (
        settings.captionsFontColor !== defaults.captionsFontColor ||
        settings.captionsFontSize !== defaults.captionsFontSize
      ) {
        overrides.public.captions.font = {};
        if (settings.captionsFontColor !== defaults.captionsFontColor) {
          overrides.public.captions.font.color = settings.captionsFontColor;
        }
        if (settings.captionsFontSize !== defaults.captionsFontSize) {
          overrides.public.captions.font.size = `${settings.captionsFontSize}px`;
        }
      }
    }

    // === VIDÉO & AUDIO ===
    const needsKurentoSection =
      settings.enableVideo !== defaults.enableVideo ||
      settings.enableScreensharing !== defaults.enableScreensharing ||
      settings.screenshareBitrate !== defaults.screenshareBitrate ||
      JSON.stringify(settings.kurento) !== JSON.stringify(defaults.kurento);

    if (needsKurentoSection) {
      ensurePublicStructure();
      overrides.public.kurento = {};

      if (settings.enableVideo !== defaults.enableVideo) {
        overrides.public.kurento.enableVideo = settings.enableVideo;
      }
      if (settings.enableScreensharing !== defaults.enableScreensharing) {
        overrides.public.kurento.enableScreensharing = settings.enableScreensharing;
      }
      if (settings.screenshareBitrate !== defaults.screenshareBitrate) {
        if (!overrides.public.kurento.screenshare) overrides.public.kurento.screenshare = {};
        overrides.public.kurento.screenshare.bitrate = settings.screenshareBitrate;
      }

      // Profils caméra personnalisés
      if (
        JSON.stringify(settings.kurento?.cameraProfiles) !==
        JSON.stringify(defaults.kurento?.cameraProfiles)
      ) {
        overrides.public.kurento.cameraProfiles = settings.kurento?.cameraProfiles;
      }

      // Paramètres screenshare personnalisés
      if (
        JSON.stringify(settings.kurento?.screenshare) !==
        JSON.stringify(defaults.kurento?.screenshare)
      ) {
        if (!overrides.public.kurento.screenshare) overrides.public.kurento.screenshare = {};
        Object.assign(overrides.public.kurento.screenshare, settings.kurento?.screenshare);
      }
    }

    // Backgrounds virtuels
    const needsVirtualBackgrounds =
      settings.virtualBackgroundsEnabled !== defaults.virtualBackgroundsEnabled ||
      settings.enableVirtualBackgroundUpload !== defaults.enableVirtualBackgroundUpload;
    if (needsVirtualBackgrounds) {
      ensurePublicStructure();
      overrides.public.virtualBackgrounds = {};
      if (settings.virtualBackgroundsEnabled !== defaults.virtualBackgroundsEnabled) {
        overrides.public.virtualBackgrounds.enabled = settings.virtualBackgroundsEnabled;
      }
      if (settings.enableVirtualBackgroundUpload !== defaults.enableVirtualBackgroundUpload) {
        overrides.public.virtualBackgrounds.enableVirtualBackgroundUpload =
          settings.enableVirtualBackgroundUpload;
      }
    }

    // === CHAT & INTERACTIONS ===
    const needsChatSection =
      settings.chatEnabled !== defaults.chatEnabled ||
      settings.chatItemsPerPage !== defaults.chatItemsPerPage ||
      settings.chatTypingIndicatorEnabled !== defaults.chatTypingIndicatorEnabled;
    if (needsChatSection) {
      ensurePublicStructure();
      overrides.public.chat = {};
      if (settings.chatEnabled !== defaults.chatEnabled) {
        overrides.public.chat.enabled = settings.chatEnabled;
      }
      if (settings.chatItemsPerPage !== defaults.chatItemsPerPage) {
        overrides.public.chat.itemsPerPage = settings.chatItemsPerPage;
      }
      if (settings.chatTypingIndicatorEnabled !== defaults.chatTypingIndicatorEnabled) {
        overrides.public.chat.typingIndicator = { enabled: settings.chatTypingIndicatorEnabled };
      }
    }

    // Réactions utilisateur
    const needsUserReaction =
      settings.userReactionEnabled !== defaults.userReactionEnabled ||
      JSON.stringify(settings.userReactionList) !== JSON.stringify(defaults.userReactionList);
    if (needsUserReaction) {
      ensurePublicStructure();
      overrides.public.userReaction = {};
      if (settings.userReactionEnabled !== defaults.userReactionEnabled) {
        overrides.public.userReaction.enabled = settings.userReactionEnabled;
      }
      if (JSON.stringify(settings.userReactionList) !== JSON.stringify(defaults.userReactionList)) {
        overrides.public.userReaction.reactions = settings.userReactionList?.map(
          (emoji, index) => ({
            id: `custom_${index}`,
            native: emoji,
          }),
        );
      }
    }

    addIfDifferent(['public', 'app', 'emojiRain', 'enabled'], 'emojiRainEnabled');

    // === OUTILS COLLABORATIFS ===
    addIfDifferent(['public', 'whiteboard', 'allowInfiniteWhiteboard'], 'whiteboardEnabled');
    addIfDifferent(['public', 'notes', 'enabled'], 'notesEnabled');

    const needsPresentationSection =
      settings.presentationDownloadEnabled !== defaults.presentationDownloadEnabled ||
      settings.presentationSnapshotEnabled !== defaults.presentationSnapshotEnabled;
    if (needsPresentationSection) {
      ensurePublicStructure();
      overrides.public.presentation = {};
      if (settings.presentationDownloadEnabled !== defaults.presentationDownloadEnabled) {
        overrides.public.presentation.allowDownloadOriginal = settings.presentationDownloadEnabled;
      }
      if (settings.presentationSnapshotEnabled !== defaults.presentationSnapshotEnabled) {
        overrides.public.presentation.allowSnapshotOfCurrentSlide =
          settings.presentationSnapshotEnabled;
      }
    }

    // === RÉUNIONS & SESSIONS ===
    const needsTimerSection =
      settings.timerEnabled !== defaults.timerEnabled ||
      settings.timerDefaultTime !== defaults.timerDefaultTime;
    if (needsTimerSection) {
      ensurePublicStructure();
      overrides.public.timer = {};
      if (settings.timerEnabled !== defaults.timerEnabled) {
        overrides.public.timer.enabled = settings.timerEnabled;
      }
      if (settings.timerDefaultTime !== defaults.timerDefaultTime) {
        overrides.public.timer.time = settings.timerDefaultTime;
      }
    }

    const needsPollSection =
      settings.pollEnabled !== defaults.pollEnabled ||
      settings.pollCustomResponseEnabled !== defaults.pollCustomResponseEnabled;
    if (needsPollSection) {
      ensurePublicStructure();
      overrides.public.poll = {};
      if (settings.pollEnabled !== defaults.pollEnabled) {
        overrides.public.poll.enabled = settings.pollEnabled;
      }
      if (settings.pollCustomResponseEnabled !== defaults.pollCustomResponseEnabled) {
        overrides.public.poll.allowCustomResponseInput = settings.pollCustomResponseEnabled;
      }
    }

    const needsBreakoutsSection =
      settings.breakoutRoomsEnabled !== defaults.breakoutRoomsEnabled ||
      settings.breakoutRoomLimit !== defaults.breakoutRoomLimit;
    if (needsBreakoutsSection) {
      ensurePublicStructure();
      overrides.public.breakouts = {};
      if (settings.breakoutRoomsEnabled !== defaults.breakoutRoomsEnabled) {
        overrides.public.breakouts.allowUserChooseRoomByDefault = settings.breakoutRoomsEnabled;
      }
      if (settings.breakoutRoomLimit !== defaults.breakoutRoomLimit) {
        overrides.public.breakouts.breakoutRoomLimit = settings.breakoutRoomLimit;
      }
    }

    // === PERFORMANCE & RÉSEAU ===
    addIfDifferent(['public', 'enableNetworkStats'], 'enableNetworkStats');
    addIfDifferent(['public', 'enableCopyNetworkStatsButton'], 'enableCopyNetworkStatsButton');
    addIfDifferent(['public', 'media', 'forceRelay'], 'mediaForceRelay');

    return overrides;
  }

  // Méthode originale renommée pour compatibilité
  async generateFullYaml(institutionId: string): Promise<string> {
    const settings = await this.findByInstitution(institutionId);

    if (!settings) {
      throw new NotFoundException('BBB Settings not found');
    }

    // Charger le template settings.yml complet
    const templatePath = path.resolve(process.cwd(), '..', 'settings.yml');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseConfig: any;

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      baseConfig = yaml.parse(templateContent);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = new (Error as any)(
        `Could not load settings template: ${error instanceof Error ? error.message : error}`,
        { cause: error },
      );
      throw err;
    }

    // Appliquer les modifications de l'utilisateur sur la configuration complète
    if (baseConfig.public) {
      // Identité & Branding
      if (baseConfig.public.branding) {
        baseConfig.public.branding.displayBrandingArea =
          settings.displayBrandingArea ?? baseConfig.public.branding.displayBrandingArea;
      }

      if (baseConfig.public.defaultSettings?.application) {
        baseConfig.public.defaultSettings.application.darkTheme =
          settings.darkTheme ?? baseConfig.public.defaultSettings.application.darkTheme;
        baseConfig.public.defaultSettings.application.webcamBorderHighlightColor =
          settings.webcamBorderHighlightColor
            ? [settings.webcamBorderHighlightColor]
            : baseConfig.public.defaultSettings.application.webcamBorderHighlightColor;
      }

      // Langue & Accessibilité
      if (baseConfig.public.app) {
        if (!baseConfig.public.app.language) baseConfig.public.app.language = {};
        baseConfig.public.app.language.locale =
          settings.defaultLocale ?? baseConfig.public.app.language?.locale;
      }

      baseConfig.public.showAllAvailableLocales =
        settings.showAllAvailableLocales ?? baseConfig.public.showAllAvailableLocales;

      if (baseConfig.public.captions) {
        baseConfig.public.captions.enabled =
          settings.captionsEnabled ?? baseConfig.public.captions.enabled;
        baseConfig.public.captions.defaultPad =
          settings.captionsDefaultPad ?? baseConfig.public.captions.defaultPad;
        if (baseConfig.public.captions.font) {
          baseConfig.public.captions.font.color =
            settings.captionsFontColor ?? baseConfig.public.captions.font.color;
          baseConfig.public.captions.font.size = settings.captionsFontSize
            ? `${settings.captionsFontSize}px`
            : baseConfig.public.captions.font.size;
        }
      }

      // Vidéo & Audio
      if (baseConfig.public.kurento) {
        baseConfig.public.kurento.enableVideo =
          settings.enableVideo ?? baseConfig.public.kurento.enableVideo;
        baseConfig.public.kurento.enableScreensharing =
          settings.enableScreensharing ?? baseConfig.public.kurento.enableScreensharing;

        if (baseConfig.public.kurento.screenshare) {
          baseConfig.public.kurento.screenshare.bitrate =
            settings.screenshareBitrate ?? baseConfig.public.kurento.screenshare.bitrate;
        }

        // Appliquer la qualité vidéo en modifiant le profil par défaut
        if (settings.videoQuality && baseConfig.public.kurento.cameraProfiles) {
          baseConfig.public.kurento.cameraProfiles.forEach((profile) => {
            profile.default = profile.id === settings.videoQuality;
          });
        }

        // Appliquer les paramètres Kurento personnalisés
        if (settings.kurento) {
          // Profils caméra personnalisés
          if (settings.kurento.cameraProfiles) {
            baseConfig.public.kurento.cameraProfiles = settings.kurento.cameraProfiles;
          }

          // Profil par défaut
          if (settings.kurento.defaultCameraProfile && baseConfig.public.kurento.cameraProfiles) {
            baseConfig.public.kurento.cameraProfiles.forEach((profile) => {
              profile.default = profile.id === settings.kurento.defaultCameraProfile;
            });
          }

          // Paramètres de partage d'écran
          if (settings.kurento.screenshare) {
            if (!baseConfig.public.kurento.screenshare) {
              baseConfig.public.kurento.screenshare = {};
            }

            if (settings.kurento.screenshare.constraints) {
              baseConfig.public.kurento.screenshare.constraints = {
                ...baseConfig.public.kurento.screenshare.constraints,
                ...settings.kurento.screenshare.constraints,
              };
            }

            if (typeof settings.kurento.screenshare.pagination === 'boolean') {
              baseConfig.public.kurento.screenshare.pagination =
                settings.kurento.screenshare.pagination;
            }
          }
        }
      }

      if (baseConfig.public.virtualBackgrounds) {
        baseConfig.public.virtualBackgrounds.enabled =
          settings.virtualBackgroundsEnabled ?? baseConfig.public.virtualBackgrounds.enabled;
        baseConfig.public.virtualBackgrounds.enableVirtualBackgroundUpload =
          settings.enableVirtualBackgroundUpload ??
          baseConfig.public.virtualBackgrounds.enableVirtualBackgroundUpload;
      }

      // Chat & Interactions
      if (baseConfig.public.chat) {
        baseConfig.public.chat.enabled = settings.chatEnabled ?? baseConfig.public.chat.enabled;
        baseConfig.public.chat.itemsPerPage =
          settings.chatItemsPerPage ?? baseConfig.public.chat.itemsPerPage;
        if (baseConfig.public.chat.typingIndicator) {
          baseConfig.public.chat.typingIndicator.enabled =
            settings.chatTypingIndicatorEnabled ?? baseConfig.public.chat.typingIndicator.enabled;
        }
      }

      if (baseConfig.public.userReaction) {
        baseConfig.public.userReaction.enabled =
          settings.userReactionEnabled ?? baseConfig.public.userReaction.enabled;
        if (settings.userReactionList && Array.isArray(settings.userReactionList)) {
          baseConfig.public.userReaction.reactions = settings.userReactionList.map(
            (emoji, index) => ({
              id: `custom_${index}`,
              native: emoji,
            }),
          );
        }
      }

      if (baseConfig.public.app?.emojiRain) {
        baseConfig.public.app.emojiRain.enabled =
          settings.emojiRainEnabled ?? baseConfig.public.app.emojiRain.enabled;
      }

      // Outils Collaboratifs
      if (baseConfig.public.whiteboard) {
        baseConfig.public.whiteboard.allowInfiniteWhiteboard =
          settings.whiteboardEnabled ?? baseConfig.public.whiteboard.allowInfiniteWhiteboard;
      }

      if (baseConfig.public.notes) {
        baseConfig.public.notes.enabled = settings.notesEnabled ?? baseConfig.public.notes.enabled;
      }

      if (baseConfig.public.presentation) {
        baseConfig.public.presentation.allowDownloadOriginal =
          settings.presentationDownloadEnabled ??
          baseConfig.public.presentation.allowDownloadOriginal;
        baseConfig.public.presentation.allowSnapshotOfCurrentSlide =
          settings.presentationSnapshotEnabled ??
          baseConfig.public.presentation.allowSnapshotOfCurrentSlide;
      }

      // Réunions & Sessions
      if (baseConfig.public.timer) {
        baseConfig.public.timer.enabled = settings.timerEnabled ?? baseConfig.public.timer.enabled;
        baseConfig.public.timer.time = settings.timerDefaultTime ?? baseConfig.public.timer.time;
      }

      if (baseConfig.public.poll) {
        baseConfig.public.poll.enabled = settings.pollEnabled ?? baseConfig.public.poll.enabled;
        baseConfig.public.poll.allowCustomResponseInput =
          settings.pollCustomResponseEnabled ?? baseConfig.public.poll.allowCustomResponseInput;
      }

      if (baseConfig.public.breakouts) {
        baseConfig.public.breakouts.allowUserChooseRoomByDefault =
          settings.breakoutRoomsEnabled ?? baseConfig.public.breakouts.allowUserChooseRoomByDefault;
        baseConfig.public.breakouts.breakoutRoomLimit =
          settings.breakoutRoomLimit ?? baseConfig.public.breakouts.breakoutRoomLimit;
      }

      // Performance & Réseau
      baseConfig.public.enableNetworkStats =
        settings.enableNetworkStats ?? baseConfig.public.enableNetworkStats;
      baseConfig.public.enableCopyNetworkStatsButton =
        settings.enableCopyNetworkStatsButton ?? baseConfig.public.enableCopyNetworkStatsButton;

      if (baseConfig.public.media) {
        baseConfig.public.media.forceRelay =
          settings.mediaForceRelay ?? baseConfig.public.media.forceRelay;
      }
    }

    return yaml.stringify(baseConfig);
  }

  async initializeDefaultsForExistingInstitution(institutionId: string): Promise<BbbSettings> {
    // Vérifier si des paramètres existent déjà
    const existing = await this.bbbSettingsRepository.findOne({
      where: { institutionId },
    });

    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`BBB settings already exist for institution ${institutionId}`);
      return existing;
    }

    // Créer les paramètres par défaut
    const defaultSettings = await this.getDefaultSettings();
    const newSettings = await this.create(institutionId, defaultSettings);

    // eslint-disable-next-line no-console
    console.log(`Initialized BBB settings for existing institution ${institutionId}`);
    return newSettings;
  }

  async getDefaultSettings(): Promise<Partial<BbbSettings>> {
    let kurentoDefaults = {};

    // Charger les profils par défaut depuis settings.yml
    try {
      const templatePath = path.resolve(process.cwd(), '..', 'settings.yml');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const baseConfig = yaml.parse(templateContent);

      if (baseConfig.public?.kurento?.cameraProfiles) {
        kurentoDefaults = {
          cameraProfiles: baseConfig.public.kurento.cameraProfiles,
          defaultCameraProfile:
            baseConfig.public.kurento.cameraProfiles.find((p) => p.default)?.id || 'medium',
          screenshare: {
            constraints: baseConfig.public.kurento.screenshare?.constraints || {
              video: {
                frameRate: {
                  ideal: 30,
                  max: 30,
                },
              },
            },
            pagination: baseConfig.public.kurento.screenshare?.pagination || false,
          },
        };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        'Could not load default camera profiles from settings.yml:',
        error instanceof Error ? error.message : error,
      );
      // Profils par défaut de secours
      kurentoDefaults = {
        cameraProfiles: [
          { id: 'low', name: 'Low', default: false, bitrate: 100 },
          { id: 'medium', name: 'Medium', default: true, bitrate: 200 },
          {
            id: 'high',
            name: 'High',
            default: false,
            bitrate: 500,
            constraints: { width: 1280, height: 720, frameRate: 15 },
          },
          {
            id: 'hd',
            name: 'High definition',
            default: false,
            bitrate: 800,
            constraints: { width: 1280, height: 720, frameRate: 30 },
          },
        ],
        defaultCameraProfile: 'medium',
        screenshare: {
          constraints: {
            video: {
              frameRate: {
                ideal: 30,
                max: 30,
              },
            },
          },
          pagination: false,
        },
      };
    }

    return {
      // Identité & Branding
      displayBrandingArea: true,
      darkTheme: false,
      webcamBorderHighlightColor: '#0084ff',

      // Langue & Accessibilité
      defaultLocale: 'fr',
      showAllAvailableLocales: true,
      captionsEnabled: false,
      captionsDefaultPad: 'fr',
      captionsFontColor: '#ffffff',
      captionsFontSize: 20,

      // Vidéo & Audio
      enableVideo: true,
      videoQuality: 'medium',
      kurento: kurentoDefaults,
      enableScreensharing: true,
      screenshareBitrate: 1200,
      virtualBackgroundsEnabled: false,
      enableVirtualBackgroundUpload: false,

      // Chat & Interactions
      chatEnabled: true,
      chatItemsPerPage: 100,
      userReactionEnabled: true,
      userReactionList: ['👍', '👎', '👏', '😂', '😮', '😕'],
      emojiRainEnabled: false,
      chatTypingIndicatorEnabled: true,

      // Outils Collaboratifs
      whiteboardEnabled: true,
      notesEnabled: true,
      presentationDownloadEnabled: true,
      presentationSnapshotEnabled: true,

      // Réunions & Sessions
      timerEnabled: true,
      timerDefaultTime: 300,
      pollEnabled: true,
      pollCustomResponseEnabled: false,
      breakoutRoomsEnabled: true,
      breakoutRoomLimit: 8,

      // Performance & Réseau
      enableNetworkStats: false,
      enableCopyNetworkStatsButton: false,
      mediaForceRelay: false,
    };
  }
}
