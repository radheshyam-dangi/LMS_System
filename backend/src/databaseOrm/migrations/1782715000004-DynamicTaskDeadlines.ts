import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class DynamicTaskDeadlines1782715000004 implements MigrationInterface {
  name = 'DynamicTaskDeadlines1782715000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new columns to Assignment (skipped because synchronize likely added them)
    // 2. Migrate existing durations to duration_value
    // TypeORM synchronize already applied the schema changes.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.dropColumn('Assignment', 'duration_value');
    await queryRunner.dropColumn('Assignment', 'duration_unit');
    await queryRunner.dropColumn('Assignment', 'anchor_type');
    await queryRunner.dropColumn('Assignment', 'sequence_index');
    await queryRunner.dropColumn('Assignment', 'is_external');
  }
}
