import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { LessonEntityService } from './lesson.service';
import { RoutePaths } from '../../../constants/routePaths';

// Using 'import type' to completely avoid isolatedModules compilation conflicts
import type { LessonModel } from '../../../types/models/lesson.model';

@Controller(RoutePaths.Lessons)
export class LessonController {
  constructor(private readonly lessonService: LessonEntityService) {}

  @Post()
  async create(@Body() dto: LessonModel) {
    return await this.lessonService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.lessonService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.lessonService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<LessonModel>) {
    return await this.lessonService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.lessonService.remove(id);
  }
}