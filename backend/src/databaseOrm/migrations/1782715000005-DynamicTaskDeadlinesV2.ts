import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class DynamicTaskDeadlinesV21782715000005 implements MigrationInterface {
  name = 'DynamicTaskDeadlinesV21782715000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const assignmentTable = await queryRunner.getTable('Assignment');
    if (assignmentTable?.findColumnByName('anchor_type')) {
      await queryRunner.dropColumn('Assignment', 'anchor_type');
    }

    const submissionTable = await queryRunner.getTable('AssignmentSubmission');
    if (submissionTable) {
      if (submissionTable.findColumnByName('anchor_resolved_at')) {
        await queryRunner.dropColumn('AssignmentSubmission', 'anchor_resolved_at');
      }
      if (submissionTable.findColumnByName('assigned_at')) {
        await queryRunner.dropColumn('AssignmentSubmission', 'assigned_at');
      }
      if (submissionTable.findColumnByName('lessons_completed_at')) {
        await queryRunner.dropColumn('AssignmentSubmission', 'lessons_completed_at');
      }
      if (submissionTable.findColumnByName('previous_task_submitted_at')) {
        await queryRunner.dropColumn('AssignmentSubmission', 'previous_task_submitted_at');
      }
      
      if (submissionTable.findColumnByName('started_at')) {
        await queryRunner.renameColumn('AssignmentSubmission', 'started_at', 'timer_started_at');
      }
      
      if (submissionTable.findColumnByName('deadline_at')) {
        await queryRunner.renameColumn('AssignmentSubmission', 'deadline_at', 'computed_deadline');
      }
      
      if (!submissionTable.findColumnByName('deadline_mode')) {
        await queryRunner.addColumn('AssignmentSubmission', new TableColumn({
            name: 'deadline_mode',
            type: 'varchar',
            isNullable: true
        }));
      }
      if (!submissionTable.findColumnByName('deadline_anchor_at')) {
        await queryRunner.addColumn('AssignmentSubmission', new TableColumn({
            name: 'deadline_anchor_at',
            type: 'timestamp',
            isNullable: true
        }));
      }
      if (!submissionTable.findColumnByName('unlocked_at')) {
        await queryRunner.addColumn('AssignmentSubmission', new TableColumn({
            name: 'unlocked_at',
            type: 'timestamp',
            isNullable: true
        }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  }
}
