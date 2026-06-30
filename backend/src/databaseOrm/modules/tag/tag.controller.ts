import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { TagService } from './tag.service';
import { RoutePaths } from '../../../constants/routePaths';
import type { TagModel } from '../../../types/models/tag.model';

@Controller(RoutePaths.Tags)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  async create(@Body() dto: TagModel) {
    return await this.tagService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.tagService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.tagService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<TagModel>) {
    return await this.tagService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.tagService.remove(id);
  }
}