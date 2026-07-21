import { Controller, Get, Post, Body, Param, Put, UseGuards, BadRequestException, NotFoundException, Delete } from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { RoutePaths } from '../../../constants/routePaths';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller(RoutePaths.LearningPaths)
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathEntityService) {}

  // ONLY Admin and Trainer can create Learning Paths
@Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    if (!creatorId) {
      throw new BadRequestException('User session details missing.');
    }
    return await this.learningPathService.createPathWithUser(dto, creatorId);
  }

  // Everyone (Admin, Trainer, Trainee) can view paths (filtered dynamically inside service by role)
  @Get()
  async findAll(@GetUser() currentUser: any) {
    const role = currentUser?.role || currentUser?.primaryRole || 'Trainee';
    const userId = currentUser?.id || currentUser?.sub;
    return await this.learningPathService.findAllPathsForUser(role, userId);
  }
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const path = await this.learningPathService.findPathWithDetails(id);
    if (path === null) {
      throw new NotFoundException(`Learning Path with ID "${id}" not found.`);
    }
    return path;
  }

  // ONLY Admin and Trainer can assign paths to Trainees
  @Put(':id/assign')
  @Roles('Admin', 'Trainer')
  async assignTrainee(@Param('id') pathId: string, @Body() body: { traineeId: string }) {
    return await this.learningPathService.assignPathToTrainee(pathId, body.traineeId);
  }
  @Delete(':id')
  @Roles('Admin', 'Trainer')
  async deletePath(@Param('id') id: string, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    const role = currentUser?.role || currentUser?.primaryRole || 'Trainer';

    if (!userId) {
      throw new BadRequestException('User session details missing.');
    }

    return await this.learningPathService.deletePath(id, userId, role);
  }
}

