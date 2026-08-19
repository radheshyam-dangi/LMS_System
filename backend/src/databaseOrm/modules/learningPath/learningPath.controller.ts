import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { RoutePaths } from '../../../constants/routePaths';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller(RoutePaths.LearningPaths)
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningPathController {
  constructor(private readonly lpService: LearningPathEntityService) {}

  @Get()
  async findAll() {
    return await this.lpService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.lpService.findPathWithDetails(id);
  }

  /**
   * 2. CREATE LEARNING PATH - Any Trainer or Admin can create their own track
   */
  @Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    return await this.lpService.createPath(dto, creatorId);
  }

  /**
   * 3. UPDATE LEARNING PATH - Restricted to ADMIN or PATH OWNER ONLY
   */
  @Put(':id')
  @Roles('Admin', 'Trainer')
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @GetUser() currentUser: any,
  ) {
    await this.verifyOwnerOrAdmin(id, currentUser);
    return await this.lpService.updatePath(id, dto);
  }

  /**
   * 4. DELETE LEARNING PATH - Restricted to ADMIN or PATH OWNER ONLY
   */
  @Delete(':id')
  @Roles('Admin', 'Trainer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @GetUser() currentUser: any) {
    await this.verifyOwnerOrAdmin(id, currentUser);
    return await this.lpService.deletePath(id);
  }

  /**
   * 5. ASSIGN TRAINEE - ALL Trainers & Admins can assign trainees!
   */
  @Post(':id/assign')
  @Roles('Admin', 'Trainer')
  async assignTrainee(
    @Param('id') id: string,
    @Body() body: { traineeId?: string; traineeIds?: string[] },
    @GetUser() currentUser: any,
  ) {
    const idsToAssign =
      body.traineeIds || (body.traineeId ? [body.traineeId] : []);

    if (idsToAssign.length === 0) {
      throw new BadRequestException('At least one Trainee ID is required.');
    }

    let updatedPath;
    const assignerId = currentUser?.id || currentUser?.sub;
    for (const tId of idsToAssign) {
      updatedPath = await this.lpService.assignTraineeToPath(id, tId, assignerId);
    }

    return updatedPath;
  }

  // 🛡️ Helper: Verify Owner or Admin
  private async verifyOwnerOrAdmin(pathId: string, currentUser: any) {
    const roles: string[] = [];
    const push = (v: any) => {
      if (!v) return;
      if (typeof v === 'string') roles.push(v.toLowerCase());
      else if (v?.name) roles.push(String(v.name).toLowerCase());
    };
    push(currentUser?.role);
    push(currentUser?.primaryRole);
    push(currentUser?.activeRole);
    if (Array.isArray(currentUser?.roles)) currentUser.roles.forEach(push);

    if (roles.includes('admin')) return;

    const path = await this.lpService.findOne(pathId);
    const ownerId = path?.createdBy?.id || (path as any)?.createdById;
    const currentUserId = currentUser.id || currentUser.sub;

    if (
      !path ||
      String(ownerId || '').toLowerCase() !==
        String(currentUserId || '').toLowerCase()
    ) {
      throw new ForbiddenException(
        'Access Denied: Only the Learning Path Owner or an Admin can edit or delete this path.',
      );
    }
  }
}
