import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDummyLearningContent1782715000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "LearningPath" (id, title, description, status, "createdBy", created_at, updated_at) VALUES
        ('30000000-0000-0000-0000-000000000001', 'Backend Engineering Foundations', 'Practical NestJS, PostgreSQL, and API design path.', 'published', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('30000000-0000-0000-0000-000000000002', 'Advanced API Engineering', 'Production-grade APIs with testing, evaluation, and deployment practices.', 'draft', '20000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Module" (id, title, description, difficulty_level, status, "parentId", "learningPathId", "createdBy", created_at, updated_at) VALUES
        ('40000000-0000-0000-0000-000000000001', 'NestJS Fundamentals', 'Controllers, services, modules, and dependency injection.', 'beginner', 'published', NULL, '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('40000000-0000-0000-0000-000000000002', 'TypeORM and PostgreSQL', 'Entities, migrations, relations, and query patterns.', 'intermediate', 'published', NULL, '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('40000000-0000-0000-0000-000000000003', 'Testing REST APIs', 'Unit and e2e testing workflows for NestJS APIs.', 'intermediate', 'draft', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "LearningPathModule" (id, "displayOrder", "learningPathId", "moduleId", created_at, updated_at) VALUES
        ('50000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('50000000-0000-0000-0000-000000000002', 2, '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('50000000-0000-0000-0000-000000000003', 1, '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Lesson" (id, title, description, duration_minutes, display_order, "moduleId", created_at, updated_at) VALUES
        ('60000000-0000-0000-0000-000000000001', 'Project Structure in NestJS', 'Create modules, controllers, and providers cleanly.', 35, 1, '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000002', 'Dependency Injection Practice', 'Wire services and repositories through providers.', 45, 2, '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000003', 'Designing TypeORM Entities', 'Map domain models, columns, and relations.', 50, 1, '40000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000004', 'Writing Migrations', 'Create reversible migrations and seed data.', 40, 2, '40000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Assignment" (id, title, description, instructions, difficulty_level, assignment_type, max_score, due_date, lesson_id, created_by, created_at, updated_at) VALUES
        ('70000000-0000-0000-0000-000000000001', 'Build a User Module', 'Create a CRUD module for users.', 'Submit a GitHub repository with controller, service, and tests.', 'beginner', 'project', 100, NOW() + INTERVAL '14 days', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('70000000-0000-0000-0000-000000000002', 'Model LMS Relations', 'Create entities and migrations for learning content.', 'Submit entity files and a successful migration run log.', 'intermediate', 'project', 100, NOW() + INTERVAL '21 days', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Tag" (id, name, created_at, updated_at) VALUES
        ('80000000-0000-0000-0000-000000000001', 'nestjs', NOW(), NOW()),
        ('80000000-0000-0000-0000-000000000002', 'typeorm', NOW(), NOW()),
        ('80000000-0000-0000-0000-000000000003', 'postgresql', NOW(), NOW()),
        ('80000000-0000-0000-0000-000000000004', 'testing', NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "ModuleTag" (id, "moduleId", "tagId", created_at, updated_at) VALUES
        ('90000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('90000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('90000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', NOW(), NOW()),
        ('90000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "ModuleKeyPoint" (id, title, description, "moduleId", created_at, updated_at) VALUES
        ('91000000-0000-0000-0000-000000000001', 'Provider lifecycle', 'Understand how Nest resolves and shares providers.', '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('91000000-0000-0000-0000-000000000002', 'Relation mapping', 'Use explicit join columns for predictable database schemas.', '40000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('91000000-0000-0000-0000-000000000003', 'Test isolation', 'Keep test data deterministic and reversible.', '40000000-0000-0000-0000-000000000003', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "ModulePrerequisite" (id, "moduleId", "prerequisiteModuleId", created_at, updated_at) VALUES
        ('92000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('92000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "ModulePrerequisite" WHERE id IN ('92000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002');`);
    await queryRunner.query(`DELETE FROM "ModuleKeyPoint" WHERE id IN ('91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000003');`);
    await queryRunner.query(`DELETE FROM "ModuleTag" WHERE id IN ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004');`);
    await queryRunner.query(`DELETE FROM "Tag" WHERE id IN ('80000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004');`);
    await queryRunner.query(`DELETE FROM "Assignment" WHERE id IN ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002');`);
    await queryRunner.query(`DELETE FROM "Lesson" WHERE id IN ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000004');`);
    await queryRunner.query(`DELETE FROM "LearningPathModule" WHERE id IN ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003');`);
    await queryRunner.query(`DELETE FROM "Module" WHERE id IN ('40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001');`);
    await queryRunner.query(`DELETE FROM "LearningPath" WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002');`);
  }
}
