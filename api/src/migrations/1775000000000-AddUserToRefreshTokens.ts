import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Binds refresh tokens to the user they were issued for.
 * Legacy tokens (bound only to an institution) can no longer be refreshed and are removed:
 * affected users simply have to log in again.
 * Idempotent, since `synchronize: true` may already have created the column.
 */
export class AddUserToRefreshTokens1775000000000 implements MigrationInterface {
  name = 'AddUserToRefreshTokens1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "userId" uuid`);
    await queryRunner.query(`DELETE FROM "refresh_tokens" WHERE "userId" IS NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_610102b60fea1455310ccd299de'
        ) THEN
          ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "userId"`);
  }
}
