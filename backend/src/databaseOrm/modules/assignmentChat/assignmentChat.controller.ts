import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AssignmentChatService } from './assignmentChat.service';
import { JwtAuthGuard } from '../../auth/guards/JWT.auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorator/roles.decorator';

@Controller('assignments/:assignmentId/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentChatController {
  constructor(private readonly chatService: AssignmentChatService) { }

  private isChatbotEnabled(): boolean {
    const envVal = (process.env.ASSIGNMENT_CHATBOT_ENABLED || (process.env as any)['ASSIGNMENT_CHATBOT_ENABLED '])?.trim();
    return envVal === 'true' || envVal === undefined;
  }

  @Get()
  @Roles('TRAINEE')
  async getChatHistory(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    if (!this.isChatbotEnabled()) {
      throw new HttpException('Chatbot is disabled', HttpStatus.FORBIDDEN);
    }
    return this.chatService.getChatHistory(assignmentId, req.user.id);
  }

  @Post()
  @Roles('TRAINEE')
  async sendMessage(
    @Param('assignmentId') assignmentId: string,
    @Body('message') message: string,
    @Body('focusQuestionIds') focusQuestionIds: string[],
    @Req() req: any
  ) {
    if (!this.isChatbotEnabled()) {
      throw new HttpException('Chatbot is disabled', HttpStatus.FORBIDDEN);
    }

    // We should implement rate limiting here, NestJS Throttler can be used on the controller or globally.
    // Assuming Throttler is global, we might want a specific throttle for this endpoint.

    return this.chatService.processUserMessage(assignmentId, req.user.id, message, focusQuestionIds);
  }

  @Delete()
  @Roles('TRAINEE')
  async clearChat(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    if (!this.isChatbotEnabled()) {
      throw new HttpException('Chatbot is disabled', HttpStatus.FORBIDDEN);
    }
    return this.chatService.clearChat(assignmentId, req.user.id);
  }
}
