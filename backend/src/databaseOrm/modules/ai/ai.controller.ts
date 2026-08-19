import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AiEntityService } from './ai.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';
import { GetUser } from '../../../common/decorator/GetUser.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiEntityService) {}

  @Get('conversations')
  @Roles('Admin', 'Trainer', 'Trainee')
  async list(@GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    if (!userId) throw new ForbiddenException('User session missing.');
    return await this.aiService.listConversations(userId);
  }

  @Post('conversations')
  @Roles('Admin', 'Trainer', 'Trainee')
  async create(@Body() body: { title?: string }, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.aiService.createConversation(userId, body?.title);
  }

  @Get('conversations/:id')
  @Roles('Admin', 'Trainer', 'Trainee')
  async getOne(@Param('id') id: string, @GetUser() currentUser: any) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.aiService.getConversation(id, userId);
  }

  @Post('conversations/:id/messages')
  @Roles('Admin', 'Trainer', 'Trainee')
  async sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @GetUser() currentUser: any,
  ) {
    const userId = currentUser?.id || currentUser?.sub;
    return await this.aiService.addMessage(id, userId, body.content || '');
  }

  @Get('feedback/submission/:submissionId')
  @Roles('Admin', 'Trainer', 'Trainee')
  async feedbackForSubmission(@Param('submissionId') submissionId: string) {
    return await this.aiService.getFeedbackBySubmission(submissionId);
  }

  @Post('feedback')
  @Roles('Admin', 'Trainer')
  async createFeedback(
    @Body()
    body: {
      submissionId: string;
      generatedFeedback?: string;
      architectureReview?: string;
      improvementSuggestions?: string;
    },
  ) {
    return await this.aiService.createFeedback(body);
  }
}
