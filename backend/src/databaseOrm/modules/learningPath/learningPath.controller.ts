import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Put, 
  Delete, 
  HttpCode, 
  HttpStatus, 
  UseGuards, 
  BadRequestException 
} from '@nestjs/common';
import { LearningPathEntityService } from './learningPath.service';
import { RoutePaths } from '../../../constants/routePaths';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard'; 
import type { LearningPathModel } from '../../../types/models/learningPath.model';

@Controller(RoutePaths.LearningPaths)
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathEntityService) {}

 
  @Post()
  @UseGuards(JwtAuthGuard) 
  async create(@Body() dto: any, @GetUser() currentUser: any) {
    if (!currentUser) {
      throw new BadRequestException('Unauthorized request: No active user session detected.');
    }
                                   
    // Extract user tracking metrics cleanly from passport token payload strategy
    const creatorId = currentUser.id || currentUser.sub;
    
    if (!creatorId) {
      throw new BadRequestException('User identification parameters are missing from dynamic session.');
    }

    return await this.learningPathService.createPathWithUser(dto, creatorId);
  }

  @Get()
  async findAll() {
    return await this.learningPathService.findActivePathsWithModules();
  }


  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.learningPathService.findOne(id);
  }

 
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<LearningPathModel>) {
    return await this.learningPathService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.learningPathService.remove(id);
  }

 
  @Put(':id/assign')
  @HttpCode(HttpStatus.OK)
  async assignTrainee(
    @Param('id') pathId: string,
    @Body() body: { traineeId: string }
  ) {
    return await this.learningPathService.assignPathToTrainee(pathId, body.traineeId);
  }
}