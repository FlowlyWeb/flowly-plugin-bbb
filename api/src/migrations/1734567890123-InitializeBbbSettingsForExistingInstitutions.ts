import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitializeBbbSettingsForExistingInstitutions1734567890123 implements MigrationInterface {
  name = 'InitializeBbbSettingsForExistingInstitutions1734567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('🚀 Starting BBB settings initialization for existing institutions...');

    try {
      // Récupérer toutes les institutions qui n'ont pas encore de paramètres BBB
      const institutionsWithoutBbbSettings = await queryRunner.query(`
                SELECT i.id, i.name 
                FROM institutions i 
                LEFT JOIN bbb_settings bs ON i.id = bs.institutionId 
                WHERE bs.id IS NULL AND i.isActive = true
            `);

      // eslint-disable-next-line no-console
      console.log(
        `Found ${institutionsWithoutBbbSettings.length} institutions without BBB settings`,
      );

      if (institutionsWithoutBbbSettings.length === 0) {
        // eslint-disable-next-line no-console
        console.log('✅ No institutions need BBB settings initialization');
        return;
      }

      // Créer une instance du service BBB pour récupérer les paramètres par défaut
      // Note: En migration, nous devons construire manuellement les paramètres par défaut
      const defaultBbbSettings = await this.getDefaultBbbSettings();

      let successCount = 0;
      let errorCount = 0;

      for (const institution of institutionsWithoutBbbSettings) {
        try {
          // Insérer les paramètres BBB par défaut pour cette institution
          await queryRunner.query(
            `
                        INSERT INTO bbb_settings (
                            institutionId,
                            displayBrandingArea,
                            darkTheme,
                            webcamBorderHighlightColor,
                            defaultLocale,
                            showAllAvailableLocales,
                            captionsEnabled,
                            captionsDefaultPad,
                            captionsFontColor,
                            captionsFontSize,
                            enableVideo,
                            videoQuality,
                            kurento,
                            enableScreensharing,
                            screenshareBitrate,
                            virtualBackgroundsEnabled,
                            enableVirtualBackgroundUpload,
                            chatEnabled,
                            chatItemsPerPage,
                            userReactionEnabled,
                            userReactionList,
                            emojiRainEnabled,
                            chatTypingIndicatorEnabled,
                            whiteboardEnabled,
                            notesEnabled,
                            presentationDownloadEnabled,
                            presentationSnapshotEnabled,
                            timerEnabled,
                            timerDefaultTime,
                            pollEnabled,
                            pollCustomResponseEnabled,
                            breakoutRoomsEnabled,
                            breakoutRoomLimit,
                            enableNetworkStats,
                            enableCopyNetworkStatsButton,
                            mediaForceRelay,
                            createdAt,
                            updatedAt
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                            $31, $32, $33, $34, $35, $36, $37
                        )
                    `,
            [
              institution.id,
              defaultBbbSettings.displayBrandingArea,
              defaultBbbSettings.darkTheme,
              defaultBbbSettings.webcamBorderHighlightColor,
              defaultBbbSettings.defaultLocale,
              defaultBbbSettings.showAllAvailableLocales,
              defaultBbbSettings.captionsEnabled,
              defaultBbbSettings.captionsDefaultPad,
              defaultBbbSettings.captionsFontColor,
              defaultBbbSettings.captionsFontSize,
              defaultBbbSettings.enableVideo,
              defaultBbbSettings.videoQuality,
              JSON.stringify(defaultBbbSettings.kurento),
              defaultBbbSettings.enableScreensharing,
              defaultBbbSettings.screenshareBitrate,
              defaultBbbSettings.virtualBackgroundsEnabled,
              defaultBbbSettings.enableVirtualBackgroundUpload,
              defaultBbbSettings.chatEnabled,
              defaultBbbSettings.chatItemsPerPage,
              defaultBbbSettings.userReactionEnabled,
              JSON.stringify(defaultBbbSettings.userReactionList),
              defaultBbbSettings.emojiRainEnabled,
              defaultBbbSettings.chatTypingIndicatorEnabled,
              defaultBbbSettings.whiteboardEnabled,
              defaultBbbSettings.notesEnabled,
              defaultBbbSettings.presentationDownloadEnabled,
              defaultBbbSettings.presentationSnapshotEnabled,
              defaultBbbSettings.timerEnabled,
              defaultBbbSettings.timerDefaultTime,
              defaultBbbSettings.pollEnabled,
              defaultBbbSettings.pollCustomResponseEnabled,
              defaultBbbSettings.breakoutRoomsEnabled,
              defaultBbbSettings.breakoutRoomLimit,
              defaultBbbSettings.enableNetworkStats,
              defaultBbbSettings.enableCopyNetworkStatsButton,
              defaultBbbSettings.mediaForceRelay,
              new Date(),
              new Date(),
            ],
          );

          successCount++;
          // eslint-disable-next-line no-console
          console.log(
            `✅ Initialized BBB settings for institution: ${institution.name} (${institution.id})`,
          );
        } catch (error) {
          errorCount++;
          // eslint-disable-next-line no-console
          console.error(
            `❌ Failed to initialize BBB settings for institution: ${institution.name} (${institution.id})`,
            error,
          );
        }
      }

      // eslint-disable-next-line no-console
      console.log(`🎉 BBB settings initialization completed:`);
      // eslint-disable-next-line no-console
      console.log(`   ✅ Success: ${successCount} institutions`);
      // eslint-disable-next-line no-console
      console.log(`   ❌ Errors: ${errorCount} institutions`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('💥 Fatal error during BBB settings initialization:', error);
      throw error;
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('⚠️  Rollback: This migration cannot be safely rolled back automatically.');
    // eslint-disable-next-line no-console
    console.log(
      '   If you need to rollback, manually delete BBB settings created by this migration.',
    );
  }

  /**
   * Génère les paramètres BBB par défaut
   * Copié depuis BbbSettingsService.getDefaultSettings() mais adapté pour la migration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getDefaultBbbSettings(): Promise<any> {
    const kurentoDefaults = {
      cameraProfiles: [
        // Profils cachés pour l'adaptation automatique
        { id: 'low-u30', name: 'low-u30', bitrate: 30, hidden: true },
        { id: 'low-u25', name: 'low-u25', bitrate: 40, hidden: true },
        { id: 'low-u20', name: 'low-u20', bitrate: 50, hidden: true },
        { id: 'low-u15', name: 'low-u15', bitrate: 70, hidden: true },
        { id: 'low-u12', name: 'low-u12', bitrate: 90, hidden: true },
        { id: 'low-u8', name: 'low-u8', bitrate: 100, hidden: true },
        // Profils visibles
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
        {
          id: 'fhd',
          name: 'Camera as content',
          hidden: true,
          default: false,
          bitrate: 1500,
          constraints: { width: 1920, height: 1080 },
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
