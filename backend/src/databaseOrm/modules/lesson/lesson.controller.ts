import { Controller, Get, Post, Body, Query, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { LessonEntityService } from './lesson.service';
import { RoutePaths } from '../../../constants/routePaths';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller(RoutePaths.Lessons) // Ensure RoutePaths.Lessons is 'lessons'
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonController {
  constructor(private readonly lessonService: LessonEntityService) {}

  /**
   * POST /lessons
   * Handles creating a new lesson tied to a module
   */
  @Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    
    if (!dto.moduleId) {
      throw new BadRequestException('moduleId is required to attach lesson to a module.');
    }

    return await this.lessonService.createLessonWithModule(dto, creatorId);
  }

  @Get()
  async findAll(@Query('moduleId') moduleId?: string) {
    if (moduleId) {
      return await this.lessonService.findLessonsByModuleId(moduleId);
    }
    return await this.lessonService.findAll();
  }

  @Post(':id/progress')
  async toggleProgress(
    @Param('id') lessonId: string,
    @Body() body: { isCompleted: boolean },
    @GetUser() currentUser: any,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.lessonService.toggleLessonProgress(userId, lessonId, body.isCompleted);
  }
}