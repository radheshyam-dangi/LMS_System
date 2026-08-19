import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

import { IsString, IsEmail, IsArray } from 'class-validator';

// 1. Define the class structure for your request payload
class SendInvitationDto {
  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsArray()
  roles: string[];

  @IsString()
  isPrimary: string;

  @IsString()
  senderName: string;

  @IsEmail()
  senderEmail: string;
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
