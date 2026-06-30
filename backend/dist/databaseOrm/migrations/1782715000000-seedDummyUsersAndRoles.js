"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedDummyUsersAndRoles1782715000000 = void 0;
class SeedDummyUsersAndRoles1782715000000 {
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await queryRunner.query(`
      INSERT INTO "Role" (id, name, created_at, updated_at) VALUES
        ('10000000-0000-0000-0000-000000000001', 'admin', NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000002', 'mentor', NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000003', 'learner', NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "User" (id, email, first_name, last_name, created_at, updated_at) VALUES
        ('20000000-0000-0000-0000-000000000001', 'admin.seed@example.com', 'Aarav', 'Admin', NOW(), NOW()),
        ('20000000-0000-0000-0000-000000000002', 'mentor.seed@example.com', 'Meera', 'Mentor', NOW(), NOW()),
        ('20000000-0000-0000-0000-000000000003', 'learner.one.seed@example.com', 'Kabir', 'Learner', NOW(), NOW()),
        ('20000000-0000-0000-0000-000000000004', 'learner.two.seed@example.com', 'Anaya', 'Learner', NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);
        await queryRunner.query(`
      INSERT INTO "UserRoles" ("userId", "roleId") VALUES
        ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
        ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
        ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003'),
        ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003')
      ON CONFLICT DO NOTHING;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DELETE FROM "UserRoles"
      WHERE "userId" IN (
        '20000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000004'
      );
    `);
        await queryRunner.query(`
      DELETE FROM "User"
      WHERE id IN (
        '20000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000004'
      );
    `);
        await queryRunner.query(`
      DELETE FROM "Role"
      WHERE id IN (
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000003'
      );
    `);
    }
}
exports.SeedDummyUsersAndRoles1782715000000 = SeedDummyUsersAndRoles1782715000000;
//# sourceMappingURL=1782715000000-seedDummyUsersAndRoles.js.map