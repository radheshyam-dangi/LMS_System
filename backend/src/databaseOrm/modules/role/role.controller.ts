import { Controller,Get,Post,Body,Param,Put,Delete } from "@nestjs/common";
import {RoleService} from "./role.service";
import type {RoleModel} from "../../../types/models/role.model"
import { RoutePaths } from "../../../constants/routePaths";
@Controller(RoutePaths.Roles)
export class RoleConttroller{
    constructor(private readonly roleService:RoleService){}
    @Post()
      async create(@Body() createUserDto: RoleModel) {
        return await this.roleService.create(createUserDto);
      }
    
      @Get()
      async findAll() {
        return await this.roleService.findAll();
      }
    
      @Get(':id')
      async findOne(@Param('id') id: string) {
        return await this.roleService.findOne(id);
      }
    
      @Put(':id')
      async update(@Param('id') id: string, @Body() updateUserDto: Partial<RoleModel>) {
        return await this.roleService.update(id, updateUserDto);
      }
    
      @Delete(':id')
      async remove(@Param('id') id: string) {
        return await this.roleService.remove(id);
      }
}