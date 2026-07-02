import {Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { RoleConttroller } from "./role.controller"
import { RoleEntityService } from "./role.service"
import { RoleEntity } from "../../entities/role.entity"

@Module({
    imports:[
        TypeOrmModule.forFeature([RoleEntity])
    ],
    controllers:[RoleConttroller],
    providers:[RoleEntityService],
    exports:[RoleEntityService]
})
export class RoleModule{}