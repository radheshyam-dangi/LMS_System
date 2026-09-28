import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LpAuthoringService } from './lpAuthoring.service';
import { RoutePaths } from '../../../constants/routePaths';
import { GetUser } from '../../../common/decorator/GetUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller(RoutePaths.LpAuthoring)
@UseGuards(JwtAuthGuard, RolesGuard)
export class LpAuthoringController {
  constructor(private readonly lpAuthoringService: LpAuthoringService) {}

  /**
   * Submit a complete Learning Path from the Tiptap editor.
   * Accepts the parsed payload (not raw Tiptap JSON).
   */
  @Post('submit')
  @Roles('Admin', 'Trainer')
  async submitLearningPath(@Body() payload: any, @GetUser() currentUser: any) {
    console.log("RECEIVED LP PAYLOAD:", JSON.stringify(payload, null, 2));
    const creatorId = currentUser?.id || currentUser?.sub;
    const result = await this.lpAuthoringService.createLearningPathFromDocument(
      payload,
      creatorId,
    );

    // If payload includes a draftId, mark it as converted
    if (payload._draftId) {
      await this.lpAuthoringService.markDraftConverted(
        payload._draftId,
        creatorId,
      );
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // DRAFT ENDPOINTS
  // ─────────────────────────────────────────────

  @Post('drafts')
  @Roles('Admin', 'Trainer')
  async saveDraft(
    @Body() body: { draftData: any; draftId?: string; title?: string },
    @GetUser() currentUser: any,
  ) {
    const creatorId = currentUser?.id || currentUser?.sub;
    return await this.lpAuthoringService.saveDraft(
      creatorId,
      body.draftData,
      body.draftId,
      body.title,
    );
  }

  @Get('drafts')
  @Roles('Admin', 'Trainer')
  async listDrafts(@GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    return await this.lpAuthoringService.listDrafts(creatorId);
  }

  @Get('drafts/:id')
  @Roles('Admin', 'Trainer')
  async getDraft(@Param('id') id: string, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    return await this.lpAuthoringService.getDraft(id, creatorId);
  }

  @Delete('drafts/:id')
  @Roles('Admin', 'Trainer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDraft(@Param('id') id: string, @GetUser() currentUser: any) {
    const creatorId = currentUser?.id || currentUser?.sub;
    await this.lpAuthoringService.deleteDraft(id, creatorId);
  }
}
