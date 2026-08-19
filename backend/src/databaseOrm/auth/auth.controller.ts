import {
  Controller,
  Post,
  Body,
  Query,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { CompleteSignupDto } from './dto/completeSignup.dto';
import { AuthService } from './auth.service';

@Controller('auth') // <--- MUST BE 'auth'
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new BadRequestException('No refresh token provided');
    }

    const result = await this.authService.refreshTokens(refreshToken);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('complete-signup') // <--- MUST BE 'complete-signup'
  async completeSignup(
    @Query('token') token: string,
    @Body() dto: CompleteSignupDto,
  ) {
    if (dto.newPassword !== dto.retypePassword) {
      throw new BadRequestException('Passwords do not match');
    }
    return this.authService.registerInvitedUser(token, dto.newPassword);
  }
}
