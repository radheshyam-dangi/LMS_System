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
} from '@nestjs/common';
import { EnrollmentEntityService } from './enrollment.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { RoutePaths } from '../../../constants/routePaths';

@Controller(RoutePaths.Enrollments)
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentEntityService) {}

  @Post()
  @Roles('Admin', 'Trainer', 'Trainee')
  async create(
    @Body() body: { userId?: string; learningPathId: string; status?: string },
    @GetUser() currentUser: any,
  ) {
    const roles = this.extractRoles(currentUser);
    const canEnrollOthers =
      roles.includes('admin') || roles.includes('trainer');
    const userId =
      canEnrollOthers && body.userId
        ? body.userId
        : currentUser.id || currentUser.sub;

    return await this.enrollmentService.create(
      userId,
      body.learningPathId,
      body.status || 'active',
      (currentUser.id || currentUser.sub) // The person making the request is the assigner
    );
  }

  @Get('me')
  @Roles('Admin', 'Trainer', 'Trainee')
  async myEnrollments(@GetUser() currentUser: any) {
    const userId = currentUser.id || currentUser.sub;
    return await this.enrollmentService.findAll({ userId });
  }

  @Get()
  @Roles('Admin', 'Trainer', 'Trainee')
  async findAll(
    @Query('userId') userId?: string,
    @Query('learningPathId') learningPathId?: string,
    @GetUser() currentUser?: any,
  ) {
    const roles = this.extractRoles(currentUser);
    if (!roles.includes('admin') && !roles.includes('trainer')) {
      return await this.enrollmentService.findAll({
        userId: currentUser.id || currentUser.sub,
        learningPathId,
      });
    }
    return await this.enrollmentService.findAll({ userId, learningPathId });
  }

  @Get(':id')
  @Roles('Admin', 'Trainer', 'Trainee')
  async findOne(@Param('id') id: string) {
    return await this.enrollmentService.findOne(id);
  }

  @Put(':id')
  @Roles('Admin', 'Trainer')
  async update(@Param('id') id: string, @Body() dto: { status?: string }) {
    return await this.enrollmentService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'Trainer')
  async remove(@Param('id') id: string) {
    return await this.enrollmentService.remove(id);
  }

  private extractRoles(user: any): string[] {
    const roles: string[] = [];
    if (!user) return roles;
    if (typeof user.role === 'string') roles.push(user.role.toLowerCase());
    if (user.role?.name) roles.push(user.role.name.toLowerCase());
    if (typeof user.primaryRole === 'string')
      roles.push(user.primaryRole.toLowerCase());
    if (user.primaryRole?.name) roles.push(user.primaryRole.name.toLowerCase());
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => {
        if (typeof r === 'string') roles.push(r.toLowerCase());
        if (r?.name) roles.push(r.name.toLowerCase());
      });
    }
    return roles;
  }
}
