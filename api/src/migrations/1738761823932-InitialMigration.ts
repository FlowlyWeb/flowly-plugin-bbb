import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1738761823932 implements MigrationInterface {
  name = 'InitialMigration1738761823932';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "styles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company" jsonb NOT NULL, "questions" jsonb NOT NULL, "mentions" jsonb NOT NULL, "moderator" jsonb NOT NULL, "institutionId" uuid, CONSTRAINT "REL_7e303d3c6bf7e4e461a78def67" UNIQUE ("institutionId"), CONSTRAINT "PK_1f22d2e5045f508c5fce0eb6e86" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "roles" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "mollieCustomerId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "institutionId" uuid, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "institutions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "domain" character varying NOT NULL, "name" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1cc0e17b15e64cb50b8ae44bcf7" UNIQUE ("domain"), CONSTRAINT "PK_0be7539dcdba335470dc05e9690" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userAgent" character varying, "ipHash" character varying, "institutionId" uuid, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "styles" ADD CONSTRAINT "FK_7e303d3c6bf7e4e461a78def678" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_412354ee74d15b76137f5dba3e3" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_19e35a9f00a0e8cc7422bffb796" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_19e35a9f00a0e8cc7422bffb796"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_412354ee74d15b76137f5dba3e3"`);
    await queryRunner.query(
      `ALTER TABLE "styles" DROP CONSTRAINT "FK_7e303d3c6bf7e4e461a78def678"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "institutions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "styles"`);
  }
}
