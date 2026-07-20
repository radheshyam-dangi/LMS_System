import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ModuleEntityService } from './module.service';
import { RoutePaths } from '../../../constants/routePaths';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller(RoutePaths.Modules)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleEntityService) {}

  // ONLY Admin and Trainer can create Modules
  @Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    if (!creatorId) throw new BadRequestException('User identification parameters missing.');
    return await this.moduleService.createModuleForPath(dto, creatorId);
  }

  @Get()
  async findAll(@Query('learningPathId') learningPathId?: string) {
    if (learningPathId) {
      return await this.moduleService.findModulesByPathId(learningPathId);
    }
    return await this.moduleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.moduleService.findModuleWithDetails(id);
  }
}