// auth.controller.ts (or wherever this route is defined)
import { Controller, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { CompleteSignupDto } from './dto/completeSignup.dto';
import { AuthService } from './auth.service';

@Controller('auth') // <--- MUST BE 'auth'
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('complete-signup') // <--- MUST BE 'complete-signup'
  async completeSignup(
    @Query('token') token: string,
    @Body() dto: CompleteSignupDto
  ) {
    if (dto.newPassword !== dto.retypePassword) {
      throw new BadRequestException('Passwords do not match');
    }
    return this.authService.registerInvitedUser(token, dto.newPassword);
  }
}