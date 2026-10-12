import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to clean up legacy badge format (emoji strings) to new format (FontAwesome objects or null)
 *
 * Old format: { "badge": "👮" }
 * New format: { "badge": { "iconName": "shield", "color": "#FF5722" } } or { "badge": null }
 *
 * This migration converts all string badges to null to prevent crashes in the frontend and plugin.
 */
export class CleanupLegacyBadges1739110000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get all styles that might have legacy badge format
    const styles = await queryRunner.query(`
            SELECT id, questions, moderator
            FROM styles
        `);

    for (const style of styles) {
      const questionsData =
        typeof style.questions === 'string' ? JSON.parse(style.questions) : style.questions;
      const moderatorData =
        typeof style.moderator === 'string' ? JSON.parse(style.moderator) : style.moderator;

      let needsUpdate = false;

      // Check and fix questions badge
      if (questionsData.badge && typeof questionsData.badge === 'string') {
        // eslint-disable-next-line no-console
        console.log(
          `Cleaning legacy questions badge for style ${style.id}: "${questionsData.badge}"`,
        );
        questionsData.badge = null;
        needsUpdate = true;
      }

      // Check and fix moderator badge
      if (moderatorData.badge && typeof moderatorData.badge === 'string') {
        // eslint-disable-next-line no-console
        console.log(
          `Cleaning legacy moderator badge for style ${style.id}: "${moderatorData.badge}"`,
        );
        moderatorData.badge = null;
        needsUpdate = true;
      }

      // Update the record if needed
      if (needsUpdate) {
        await queryRunner.query(
          `UPDATE styles
                     SET questions = $1, moderator = $2
                     WHERE id = $3`,
          [JSON.stringify(questionsData), JSON.stringify(moderatorData), style.id],
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log('Legacy badge cleanup completed');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback needed - we can't restore the original emoji badges
    // Users will need to reconfigure their badges if they roll back
    // eslint-disable-next-line no-console
    console.log('Rollback: Legacy badges were removed, manual reconfiguration required');
  }
}
