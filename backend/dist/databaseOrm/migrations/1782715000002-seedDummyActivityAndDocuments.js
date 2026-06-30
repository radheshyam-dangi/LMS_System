"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedDummyActivityAndDocuments1782715000002 = void 0;
class SeedDummyActivityAndDocuments1782715000002 {
    async up(queryRunner) {
        await queryRunner.query(`
      INSERT INTO "Enrollment" (id, "enrolledAt", status, "userId", "learningPathId", created_at, updated_at) VALUES
        ('a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', 'active', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '3 days', 'active', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "UserLessonProgress" (id, "completedAt", "userId", "lessonId", created_at, updated_at) VALUES
        ('a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days', '20000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('a1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '1 day', '20000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('a1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '1 day', '20000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "Submission" (id, "submissionType", "githubUrl", "liveUrl", notes, status, "submittedAt", "assignmentId", "userId", created_at, updated_at) VALUES
        ('a2000000-0000-0000-0000-000000000001', 'github', 'https://github.com/example/kabir-user-module', NULL, 'Includes service and controller tests.', 'reviewed', NOW() - INTERVAL '1 day', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', NOW(), NOW()),
        ('a2000000-0000-0000-0000-000000000002', 'github', 'https://github.com/example/anaya-user-module', NULL, 'Basic CRUD is complete.', 'pending', NOW(), '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "Evaluation" (id, "technicalScore", "architectureScore", "problemSolvingScore", "documentationScore", "overallScore", feedback, "submissionId", "evaluatorId", created_at, updated_at) VALUES
        ('a3000000-0000-0000-0000-000000000001', 85, 82, 88, 80, 84, 'Good module boundaries and clean repository usage. Add more edge-case tests.', 'a2000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "Document" (id, identifier, "mimeType", "documentName", "originalDocumentName", "documentUrl", extension, encoding, "sizeBytes", "uploadCount", created_at, updated_at) VALUES
        ('a4000000-0000-0000-0000-000000000001', 'seed-nestjs-syllabus', 'application/pdf', 'nestjs-syllabus.pdf', 'NestJS Syllabus.pdf', 'https://example.com/documents/nestjs-syllabus.pdf', 'pdf', '7bit', 245760, 1, NOW(), NOW()),
        ('a4000000-0000-0000-0000-000000000002', 'seed-typeorm-checklist', 'application/pdf', 'typeorm-checklist.pdf', 'TypeORM Checklist.pdf', 'https://example.com/documents/typeorm-checklist.pdf', 'pdf', '7bit', 184320, 1, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "DocumentAssociation" (id, "associationType", "associationId", description, "refCount", "documentId", created_at, updated_at) VALUES
        ('a5000000-0000-0000-0000-000000000001', 'LearningPath', '30000000-0000-0000-0000-000000000001', 'Syllabus document for the backend foundations path.', 1, 'a4000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('a5000000-0000-0000-0000-000000000002', 'Module', '40000000-0000-0000-0000-000000000002', 'Checklist for TypeORM module work.', 1, 'a4000000-0000-0000-0000-000000000002', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DELETE FROM "DocumentAssociation" WHERE id IN ('a5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002');`);
        await queryRunner.query(`DELETE FROM "Document" WHERE id IN ('a4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002');`);
        await queryRunner.query(`DELETE FROM "Evaluation" WHERE id = 'a3000000-0000-0000-0000-000000000001';`);
        await queryRunner.query(`DELETE FROM "Submission" WHERE id IN ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002');`);
        await queryRunner.query(`DELETE FROM "UserLessonProgress" WHERE id IN ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003');`);
        await queryRunner.query(`DELETE FROM "Enrollment" WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');`);
    }
}
exports.SeedDummyActivityAndDocuments1782715000002 = SeedDummyActivityAndDocuments1782715000002;
//# sourceMappingURL=1782715000002-seedDummyActivityAndDocuments.js.map