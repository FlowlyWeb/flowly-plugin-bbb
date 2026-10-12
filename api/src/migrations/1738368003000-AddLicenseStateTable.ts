import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Add license_state table
 *
 * Creates the table for storing local license state for offline operation.
 * Only one row should exist in this table (singleton pattern).
 */
export class AddLicenseStateTable1738368003000 implements MigrationInterface {
  name = 'AddLicenseStateTable1738368003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for local license status
    await queryRunner.query(`
      CREATE TYPE "local_license_status_enum" AS ENUM (
        'active',
        'expired',
        'revoked',
        'grace_period',
        'offline_warning'
      )
    `);

    // Create license_state table
    await queryRunner.createTable(
      new Table({
        name: 'license_state',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'jwtToken',
            type: 'text',
            comment: 'JWT license token',
          },
          {
            name: 'jti',
            type: 'varchar',
            comment: 'JWT Token ID',
          },
          {
            name: 'status',
            type: 'local_license_status_enum',
            default: "'active'",
          },
          {
            name: 'expiryDate',
            type: 'timestamp',
          },
          {
            name: 'limits',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'clientId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'clientName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'lastCheckIn',
            type: 'timestamp',
            isNullable: true,
            comment: 'Last successful check-in',
          },
          {
            name: 'lastCheckInAttempt',
            type: 'timestamp',
            isNullable: true,
            comment: 'Last check-in attempt (success or failure)',
          },
          {
            name: 'consecutiveFailures',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastCheckInError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'gracePeriodStart',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('license_state');
    await queryRunner.query(`DROP TYPE "local_license_status_enum"`);
  }
}
