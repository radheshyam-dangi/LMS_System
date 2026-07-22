import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ResourceController } from "./resource.controller";
import { ResourceEntityService } from "./resource.service";
import { ResourceEntity } from "../../entities/resource.entity";

@Module({
  imports:[
    TypeOrmModule.forFeature([ResourceEntity])

  ],
  controllers:[ ResourceController],
  providers:[ResourceEntityService],
  exports:[ResourceEntityService]
})
export class ResourceModule{}