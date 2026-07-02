import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { EvaluationEntitytService } from './evaluation.service';
import { RoutePaths } from '../../../constants/routePaths';
import type { EvaluationModel } from '../../../types/models/evaluation.model';

@Controller(RoutePaths.Evaluations)
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationEntitytService) {}

  @Post()
  async create(@Body() dto: EvaluationModel) {
    return await this.evaluationService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.evaluationService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.evaluationService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<EvaluationModel>) {
    return await this.evaluationService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.evaluationService.remove(id);
  }
}