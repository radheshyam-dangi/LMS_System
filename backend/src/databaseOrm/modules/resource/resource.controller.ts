import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ResourceEntityService } from './resource.service';// Or your service name
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard'; // Adjust path if needed

import { RoutePaths } from '../../../constants/routePaths';

@Controller(RoutePaths.Resources) // 👈 Mounts directly at http://localhost:3000/resources
export class ResourceController {
  constructor(private readonly resourceService: ResourceEntityService) {}

  @Post() // 👈 Handles POST requests
  @UseGuards(JwtAuthGuard)
  async createResource(
    @Body() dto: { title: string; url: string; moduleId?: string; lessonId?: string }
  ) {
    return await this.resourceService.createResource(dto);
  }
}