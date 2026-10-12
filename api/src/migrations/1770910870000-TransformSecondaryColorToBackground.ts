import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to transform secondaryColor string to background object structure
 *
 * Old format: { "secondaryColor": "#06172A" }
 * New format: { "background": { "type": "solid", "color": "#06172A" } }
 *
 * This migration enables support for gradients and images while maintaining compatibility
 * with existing solid color configurations.
 */
export class TransformSecondaryColorToBackground1770910870000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get all styles that might have secondaryColor in old format
    const styles = await queryRunner.query(`
            SELECT id, company
            FROM styles
        `);

    for (const style of styles) {
      const companyData =
        typeof style.company === 'string' ? JSON.parse(style.company) : style.company;

      // Check if transformation is needed
      if (companyData.secondaryColor && !companyData.background) {
        // eslint-disable-next-line no-console
        console.log(
          `Transforming secondaryColor to background for style ${style.id}: "${companyData.secondaryColor}"`,
        );

        // Create new background object with solid type
        companyData.background = {
          type: 'solid',
          color: companyData.secondaryColor,
        };

        // Remove old secondaryColor field
        delete companyData.secondaryColor;

        // Update the record
        await queryRunner.query(
          `UPDATE styles
                     SET company = $1
                     WHERE id = $2`,
          [JSON.stringify(companyData), style.id],
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log('Secondary color to background transformation completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: background object → secondaryColor string
    const styles = await queryRunner.query(`
            SELECT id, company
            FROM styles
        `);

    for (const style of styles) {
      const companyData =
        typeof style.company === 'string' ? JSON.parse(style.company) : style.company;

      // Check if rollback is needed
      if (companyData.background && !companyData.secondaryColor) {
        // eslint-disable-next-line no-console
        console.log(`Rolling back background to secondaryColor for style ${style.id}`);

        // Extract color from background object (prioritize solid color, then gradient color1, then default)
        let secondaryColor = '#06172A'; // Default fallback

        if (companyData.background.type === 'solid' && companyData.background.color) {
          secondaryColor = companyData.background.color;
        } else if (
          companyData.background.type === 'gradient' &&
          companyData.background.gradient?.color1
        ) {
          secondaryColor = companyData.background.gradient.color1;
        }

        // Restore secondaryColor field
        companyData.secondaryColor = secondaryColor;

        // Remove background field
        delete companyData.background;

        // Update the record
        await queryRunner.query(
          `UPDATE styles
                     SET company = $1
                     WHERE id = $2`,
          [JSON.stringify(companyData), style.id],
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log('Background to secondary color rollback completed');
  }
}
