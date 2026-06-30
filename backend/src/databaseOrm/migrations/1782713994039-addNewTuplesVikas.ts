import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewTuplesVikas1782713994039 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`INSERT INTO "User" (id,email,first_name,last_name,created_at,updated_at) VALUES
            (gen_random_uuid(),'vikas@example.com','vikas','dangi',Now(),Now())
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "User" where "first_name" = 'vikas';
        `)
    }

}
