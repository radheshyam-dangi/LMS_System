import {Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { RoleConttroller } from "./role.controller"
import { RoleService } from "./role.service"
import { RoleEntity } from "../../entities/role.entity"

@Module({
    imports:[
        TypeOrmModule.forFeature([RoleEntity])
    ],
    controllers:[RoleConttroller],
    providers:[RoleService],
    exports:[RoleService]
})
export class RoleModule{}