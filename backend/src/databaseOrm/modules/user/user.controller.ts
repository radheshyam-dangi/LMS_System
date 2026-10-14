import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { UserEntityService } from './user.service';
import type { UserModel } from '../../../types/models/user.model';
import { RoutePaths } from '../../../constants/routePaths';
@Controller(RoutePaths.Users)
export class UserController {
  constructor(private readonly userService: UserEntityService) { }

  @Get()
  async findAll() {
    return await this.userService.findAll();
  }

  @Post('/signup')
  async signup(@Body() signUpDto: UserModel) {
    return await this.userService.create(signUpDto);
  }

  // login endpoint moved to auth.controller.ts

  @Get('/requests/roles')
  async roleRequests() {
    return await this.userService.findRoleRequests();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Get(':id/profile-stats')
  async getProfileStats(@Param('id') id: string, @Query('role') role?: string) {
    return await this.userService.getUserProfileStats(id, role);
  }

  @Put(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    if (!body?.currentPassword || !body?.newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }
    return await this.userService.changePassword(
      id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { roleName: string },
  ) {
    return await this.userService.updateUserRole(id, body.roleName);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: Partial<UserModel>,
  ) {
    return await this.userService.update(id, updateUserDto);
  }

  @Put(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return await this.userService.updateUserStatus(id, false);
  }

  @Put(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return await this.userService.updateUserStatus(id, true);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const requesterId = req?.user?.userId; // assuming JWT middleware sets this
    return await this.userService.removeUser(id, requesterId);
  }
}
