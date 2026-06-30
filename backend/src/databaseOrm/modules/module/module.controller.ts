import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ModuleService } from './module.service';
import { RoutePaths } from '../../../constants/routePaths';
// 'import type' ensures compliance with your strict isolatedModules config
import type { ModuleModel } from '../../../types/models/module.model';

@Controller(RoutePaths.Modules)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  async create(@Body() dto: ModuleModel) {
    return await this.moduleService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.moduleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.moduleService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<ModuleModel>) {
    return await this.moduleService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.moduleService.remove(id);
  }
}