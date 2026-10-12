import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `usernames` JSONB column to the `styles` table.
 * Default value `{"isEnabled": true}` ensures backward compatibility —
 * existing institutions have the usernames module enabled by default.
 * Tier-based restriction is applied at the API response level.
 */
export class AddUsernamesColumnToStyles1772700000000 implements MigrationInterface {
  name = 'AddUsernamesColumnToStyles1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "styles" ADD COLUMN "usernames" jsonb NOT NULL DEFAULT '{"isEnabled": true}'`,
    );

    // Update existing rows to have the default value explicitly
    await queryRunner.query(
      `UPDATE "styles" SET "usernames" = '{"isEnabled": true}' WHERE "usernames" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "styles" DROP COLUMN "usernames"`);
  }
}
