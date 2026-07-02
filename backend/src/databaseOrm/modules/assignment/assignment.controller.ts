import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { AssignmentEntityService } from './assignment.service';
import { RoutePaths } from '../../../constants/routePaths';
import type { AssignmentModel } from '../../../types/models/assignment.model';


@Controller(RoutePaths.Assignments)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentEntityService) {}

  @Post()
  async create(@Body() dto: AssignmentModel) {
    return await this.assignmentService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.assignmentService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.assignmentService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<AssignmentModel>) {
    return await this.assignmentService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.assignmentService.remove(id);
  }
}