"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddNewTuplesVikas1782713994039 = void 0;
class AddNewTuplesVikas1782713994039 {
    async up(queryRunner) {
        await queryRunner.query(`INSERT INTO "User" (id,email,first_name,last_name,created_at,updated_at) VALUES
            (gen_random_uuid(),'vikas@example.com','vikas','dangi',Now(),Now())
        `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
            DELETE FROM "User" where "first_name" = 'vikas';
        `);
    }
}
exports.AddNewTuplesVikas1782713994039 = AddNewTuplesVikas1782713994039;
//# sourceMappingURL=1782713994039-addNewTuplesVikas.js.map