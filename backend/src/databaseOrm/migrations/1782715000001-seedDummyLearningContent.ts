import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDummyLearningContent1782715000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "LearningPath" (id, title, description, status, "createdBy", created_at, updated_at) VALUES
        ('30000000-0000-0000-0000-000000000001', 'Full Stack Engineering', 'Master full stack web and API development.', 'published', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('30000000-0000-0000-0000-000000000002', 'Backend Engineering Foundations', 'Practical NestJS, PostgreSQL, and API design path.', 'published', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('30000000-0000-0000-0000-000000000003', 'Digital Marketing', 'Search engine optimization and modern digital growth strategies.', 'published', '20000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
    `);

    await queryRunner.query(`
      INSERT INTO "Module" (id, title, description, level, difficulty_level, duration_label, duration_weeks, objectives, outcomes, status, "parentId", "learningPathId", "createdBy", created_at, updated_at) VALUES
        (
          '40000000-0000-0000-0000-000000000004',
          'Backend API Design',
          'Design and implement production-grade RESTful APIs using Node.js and Express. Cover authentication, validation, error handling, and documentation.',
          'Intermediate',
          'Intermediate',
          '2 weeks',
          2,
          '["Understand RESTful architecture principles", "Design clean, versioned API endpoints", "Implement JWT-based authentication flows", "Write comprehensive API documentation"]'::jsonb,
          '["Build a fully functional REST API with CRUD operations", "Secure endpoints with JWT authentication", "Handle errors gracefully with proper status codes", "Document APIs using OpenAPI / Swagger"]'::jsonb,
          'published',
          NULL,
          '30000000-0000-0000-0000-000000000001',
          '20000000-0000-0000-0000-000000000002',
          NOW(), NOW()
        ),
        (
          '40000000-0000-0000-0000-000000000001',
          'NestJS Fundamentals',
          'Controllers, services, modules, and dependency injection.',
          'Beginner',
          'Beginner',
          '3 weeks',
          3,
          '["Understand NestJS module structure", "Master dependency injection", "Build scalable controller architectures"]'::jsonb,
          '["Implement NestJS modules and services", "Wire dependency injection containers", "Handle requests and responses cleanly"]'::jsonb,
          'published',
          NULL,
          '30000000-0000-0000-0000-000000000002',
          '20000000-0000-0000-0000-000000000002',
          NOW(), NOW()
        ),
        (
          '40000000-0000-0000-0000-000000000002',
          'TypeORM and PostgreSQL',
          'Entities, migrations, relations, and query patterns.',
          'Intermediate',
          'Intermediate',
          '2 weeks',
          2,
          '["Define TypeORM entities and relations", "Write reversible database migrations", "Optimize complex PostgreSQL queries"]'::jsonb,
          '["Construct relational database schemas", "Execute raw and ORM query builders", "Handle database migrations safely"]'::jsonb,
          'published',
          NULL,
          '30000000-0000-0000-0000-000000000002',
          '20000000-0000-0000-0000-000000000002',
          NOW(), NOW()
        ),
        (
          '40000000-0000-0000-0000-000000000005',
          'SEO',
          'An SEO description—also called a meta description—is a short text summary of a web page that shows up under the blue link on search engine results pages.',
          'Beginner',
          'Beginner',
          '1 week',
          1,
          '["Understand search engine indexing", "Write optimized meta titles & descriptions", "Perform keyword research for web pages"]'::jsonb,
          '["Improve organic search visibility", "Optimize page metadata for click-through rate"]'::jsonb,
          'published',
          NULL,
          '30000000-0000-0000-0000-000000000003',
          '20000000-0000-0000-0000-000000000002',
          NOW(), NOW()
        )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        level = EXCLUDED.level,
        objectives = EXCLUDED.objectives,
        outcomes = EXCLUDED.outcomes,
        duration_label = EXCLUDED.duration_label,
        duration_weeks = EXCLUDED.duration_weeks;
    `);

    await queryRunner.query(`
      INSERT INTO "LearningPathModule" (id, "displayOrder", "learningPathId", "moduleId", created_at, updated_at) VALUES
        ('50000000-0000-0000-0000-000000000004', 1, '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', NOW(), NOW()),
        ('50000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('50000000-0000-0000-0000-000000000002', 2, '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('50000000-0000-0000-0000-000000000005', 1, '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Lesson" (id, title, description, duration_minutes, display_order, "moduleId", created_at, updated_at) VALUES
        ('60000000-0000-0000-0000-000000000010', 'Introduction to REST APIs', 'Overview of HTTP verbs, endpoints, and REST principles.', 18, 1, '40000000-0000-0000-0000-000000000004', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000011', 'HTTP Methods and Status Codes', 'Proper usage of GET, POST, PUT, DELETE and HTTP status codes.', 12, 2, '40000000-0000-0000-0000-000000000004', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000012', 'Designing RESTful Endpoints', 'Naming conventions, versioning, and filtering patterns.', 22, 3, '40000000-0000-0000-0000-000000000004', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000013', 'Request/Response Schemas', 'DTO validation and JSON request/response formats.', 15, 4, '40000000-0000-0000-0000-000000000004', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000014', 'Authentication with JWT', 'Securing API endpoints using JSON Web Tokens.', 24, 5, '40000000-0000-0000-0000-000000000004', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000015', 'Error Handling Best Practices', 'Centralized error responses and exception filters.', 10, 6, '40000000-0000-0000-0000-000000000004', NOW(), NOW()),

        ('60000000-0000-0000-0000-000000000001', 'Project Structure in NestJS', 'Create modules, controllers, and providers cleanly.', 35, 1, '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000002', 'Dependency Injection Practice', 'Wire services and repositories through providers.', 45, 2, '40000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000003', 'Designing TypeORM Entities', 'Map domain models, columns, and relations.', 50, 1, '40000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000004', 'Writing Migrations', 'Create reversible migrations and seed data.', 40, 2, '40000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('60000000-0000-0000-0000-000000000005', 'SEO Page Titles', 'Crafting effective title tags for search rankings.', 30, 1, '40000000-0000-0000-0000-000000000005', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Assignment" (id, title, description, instructions, difficulty_level, assignment_type, max_score, due_date, lesson_id, created_by, created_at, updated_at) VALUES
        ('70000000-0000-0000-0000-000000000010', 'Build a REST API Controller', 'Create a production-grade API with routes, DTO validation, and error handlers.', 'Submit your Express/NestJS controller code.', 'Intermediate', 'Subjective', 100, NOW() + INTERVAL '14 days', '60000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('70000000-0000-0000-0000-000000000011', 'JWT Authentication Guard', 'Implement token verification middleware for protected routes.', 'Submit the middleware function and test cases.', 'Intermediate', 'Subjective', 100, NOW() + INTERVAL '21 days', '60000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),

        ('70000000-0000-0000-0000-000000000001', 'Build a User Module', 'Create a CRUD module for users.', 'Submit a GitHub repository with controller, service, and tests.', 'Beginner', 'Subjective', 100, NOW() + INTERVAL '14 days', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('70000000-0000-0000-0000-000000000002', 'Model LMS Relations', 'Create entities and migrations for learning content.', 'Submit entity files and a successful migration run log.', 'Intermediate', 'Subjective', 100, NOW() + INTERVAL '21 days', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "Tag" (id, name, created_at, updated_at) VALUES
        ('80000000-0000-0000-0000-000000000001', 'nestjs', NOW(), NOW()),
        ('80000000-0000-0000-0000-000000000002', 'typeorm', NOW(), NOW()),
        ('80000000-0000-0000-0000-000000000003', 'postgresql', NOW(), NOW()),
        ('80000000-0000-0000-0000-000000000004', 'express', NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "Assignment" WHERE id IN ('70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002');`,
    );
    await queryRunner.query(
      `DELETE FROM "Lesson" WHERE id IN ('60000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000015');`,
    );
    await queryRunner.query(
      `DELETE FROM "LearningPathModule" WHERE id IN ('50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005');`,
    );
    await queryRunner.query(
      `DELETE FROM "Module" WHERE id IN ('40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005');`,
    );
    await queryRunner.query(
      `DELETE FROM "LearningPath" WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003');`,
    );
  }
}
