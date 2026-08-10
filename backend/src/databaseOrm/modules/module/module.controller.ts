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
import { ModuleEntityService } from './module.service';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller('modules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleEntityService) {}

  @Get()
  async findAll(@Query('learningPathId') learningPathId?: string) {
    if (learningPathId) return await this.moduleService.findModulesByPathId(learningPathId);
    return await this.moduleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.moduleService.findModuleWithDetails(id);
  }

  @Post()
  @Roles('Admin', 'Trainer')
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    if (!dto.learningPathId) {
      throw new BadRequestException('learningPathId is required to create a module.');
    }
    await this.verifyOwnerOrAdmin(dto.learningPathId, currentUser);
    return await this.moduleService.createModuleForPath(dto, currentUser.id || currentUser.sub);
  }

  // 🔒 PUT ENDPOINT UPDATE
  @Put(':id')
  @Roles('Admin', 'Trainer')
  async updateModule(@Param('id') id: string, @Body() dto: any, @GetUser() currentUser: any) {
    // 1. Fetch Module with relations
    const module = await this.moduleService.findModuleWithDetails(id);
    
    // 2. Safely resolve Learning Path ID
    const lpId = module.learningPath?.id;
    await this.verifyOwnerOrAdmin(lpId, currentUser);

    return await this.moduleService.updateModule(id, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'Trainer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteModule(@Param('id') id: string, @GetUser() currentUser: any) {
    const module = await this.moduleService.findModuleWithDetails(id);
    await this.verifyOwnerOrAdmin(module.learningPath?.id, currentUser);
    return await this.moduleService.deleteModule(id);
  }

  private async verifyOwnerOrAdmin(learningPathId: string | undefined, currentUser: any) {
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

    if (roles.includes('admin') || roles.includes('trainer')) return;

    if (!learningPathId) {
      throw new BadRequestException('Associated Learning Path ID was not found for this module.');
    }

    const userId = currentUser.id || currentUser.sub;
    const isOwner = await this.moduleService.checkIsPathOwner(learningPathId, userId);

    if (!isOwner) {
      throw new ForbiddenException(
        'Access Denied: Only the creator of this Learning Path or an Admin can modify this module.'
      );
    }
  }
}