import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { RoutePaths } from '../../../constants/routePaths';
import type { SubmissionModel } from '../../../types/models/submission.model';

@Controller(RoutePaths.Submissions)
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  async create(@Body() dto: SubmissionModel) {
    return await this.submissionService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.submissionService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.submissionService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<SubmissionModel>) {
    return await this.submissionService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.submissionService.remove(id);
  }
}