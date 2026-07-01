import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

// 1. Define the class structure for your request payload
class SendInvitationDto {
  to: string;
  subject: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isPrimary: string;
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(@Body() invitationDto: SendInvitationDto) {
    // 2. Pass the typed DTO straight into the service
    return await this.emailService.sendInvitationEmail(invitationDto);
  }
}
