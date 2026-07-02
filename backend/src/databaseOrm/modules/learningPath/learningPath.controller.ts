import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { RoutePaths } from '../../../constants/routePaths';

// Clean 'import type' setup to keep isolatedModules fully happy
import type {LearningPathModel } from '../../../types/models/learningPath.model';

@Controller(RoutePaths.LearningPaths)
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathEntityService) {}

  @Post()
  async create(@Body() dto: LearningPathModel) {
    return await this.learningPathService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.learningPathService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.learningPathService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<LearningPathModel>) {
    return await this.learningPathService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.learningPathService.remove(id);
  }
}