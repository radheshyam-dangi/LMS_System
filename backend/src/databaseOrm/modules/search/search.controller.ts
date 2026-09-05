import { Controller, Get, Query, UseGuards, Headers, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import type { Request } from 'express';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @Headers('x-active-role') activeRole: string,
    @Req() req: Request,
  ) {
    const user = req['user'] as any;
    const effectiveRole = activeRole || user?.primaryRole || 'Trainee';
    
    if (!query || query.length < 2) {
      return { results: [] };
    }

    return this.searchService.globalSearch(query, user, effectiveRole);
  }
}
