import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { DocumentEntityService } from './document.service';
import { RoutePaths } from '../../../constants/routePaths';
import type { DocumentModel } from '../../../types/models/document.model';

@Controller(RoutePaths.Documents)
export class DocumentController {
  constructor(private readonly documentService: DocumentEntityService) {}

  @Post()
  async create(@Body() dto: DocumentModel) {
    return await this.documentService.create(dto);
  }

  @Get()
  async findAll() {
    return await this.documentService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.documentService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<DocumentModel>) {
    return await this.documentService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.documentService.remove(id);
  }
}