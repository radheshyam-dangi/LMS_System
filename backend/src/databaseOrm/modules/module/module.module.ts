import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModuleController } from "./module.controller";
import { ModuleService } from "./module.service";
import { ModuleEntity } from "../../entities/module.entity";
import { ModuleKeyPointEntity } from "../../entities/moduleKeyPoint.entity";
import { ModulePrerequisiteEntity } from "../../entities/modulePrerequisite.entity";

@Module({
  imports:[
    TypeOrmModule.forFeature([ModuleEntity,ModuleKeyPointEntity,ModulePrerequisiteEntity])

  ],
  controllers:[ModuleController],
  providers:[ModuleService],
  exports:[ModuleService]
})
export class ModuleModule{}