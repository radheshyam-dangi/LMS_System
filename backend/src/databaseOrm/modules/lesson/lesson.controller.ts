import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { LessonEntityService } from './lesson.service';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonController {
  constructor(private readonly lessonService: LessonEntityService) {}

  @Get()
  async findAll(
    @Query('moduleId') moduleId?: string,
    @Query('learningPathId') learningPathId?: string,
  ) {
    if (moduleId)
      return await this.lessonService.findLessonsByModuleId(moduleId);
    if (learningPathId)
      return await this.lessonService.findLessonsByPathId(learningPathId);
    return await this.lessonService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.lessonService.findLessonById(id);
  }

  // 🔒 CREATE LESSON
  @Post()
  @Roles('Admin', 'Trainer')
  async createLesson(@Body() dto: any, @GetUser() currentUser: any) {
    if (!dto.moduleId) {
      throw new BadRequestException(
        'moduleId is required in payload to create a lesson.',
      );
    }
    await this.verifyOwnerOrAdmin(dto.moduleId, currentUser);

    const userId = currentUser.id || currentUser.sub;
    return await this.lessonService.createLesson(dto, userId);
  }

  // 🔒 EDIT LESSON
  @Put(':id')
  @Roles('Admin', 'Trainer')
  async updateLesson(
    @Param('id') id: string,
    @Body() dto: any,
    @GetUser() currentUser: any,
  ) {
    const lesson = await this.lessonService.findLessonById(id);
    const moduleId = lesson.module?.id;

    await this.verifyOwnerOrAdmin(moduleId, currentUser);
    return await this.lessonService.updateLesson(id, dto);
  }

  // 🔒 DELETE LESSON
  @Delete(':id')
  @Roles('Admin', 'Trainer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLesson(@Param('id') id: string, @GetUser() currentUser: any) {
    const lesson = await this.lessonService.findLessonById(id);
    const moduleId = lesson.module?.id;

    await this.verifyOwnerOrAdmin(moduleId, currentUser);
    return await this.lessonService.deleteLesson(id);
  }

  // 🛡️ Helper: Handles safe role extraction & ID comparison
  private async verifyOwnerOrAdmin(
    moduleId: string | undefined,
    currentUser: any,
  ) {
    if (!currentUser) {
      throw new ForbiddenException('User authentication session missing.');
    }

    // Extract roles from all common user payload variations
    const roles: string[] = [];
    if (typeof currentUser.role === 'string')
      roles.push(currentUser.role.toLowerCase());
    if (currentUser.role?.name) roles.push(currentUser.role.name.toLowerCase());
    if (typeof currentUser.primaryRole === 'string')
      roles.push(currentUser.primaryRole.toLowerCase());
    if (currentUser.primaryRole?.name)
      roles.push(currentUser.primaryRole.name.toLowerCase());
    if (Array.isArray(currentUser.roles)) {
      currentUser.roles.forEach((r: any) => {
        if (typeof r === 'string') roles.push(r.toLowerCase());
        if (r?.name) roles.push(r.name.toLowerCase());
      });
    }

    // 1. ADMIN & TRAINER BYPASS
    if (roles.includes('admin') || roles.includes('trainer')) return;

    if (!moduleId) {
      throw new BadRequestException('Associated Module ID was not found.');
    }

    // 2. OWNERSHIP VERIFICATION
    const userId = currentUser.id || currentUser.sub;
    if (!userId) {
      throw new ForbiddenException('User ID token claim is missing.');
    }

    const isOwner = await this.lessonService.checkIsModulePathOwner(
      moduleId,
      userId,
    );

    if (!isOwner) {
      throw new ForbiddenException(
        'Access Denied: Only the creator of this Learning Path or an Admin can modify lessons.',
      );
    }
  }
}
