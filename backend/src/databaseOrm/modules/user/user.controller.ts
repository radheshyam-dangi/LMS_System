import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import type{ UserModel } from '../../../types/models/user.model';
import { RoutePaths } from '../../../constants/routePaths';
@Controller(RoutePaths.Users)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll() {
    return await this.userService.findAll();
  }

  @Post('/signup')
  async signup(@Body() signUpDto: UserModel) {   
    return await this.userService.create(signUpDto);
  }

  @Post('/login')
  async login(@Body() body: Pick<UserModel, 'email' | 'password'>) {
    return await this.userService.login(body.email, body.password ?? '');
  }

  @Get('/requests/roles')
  async roleRequests() {
    return await this.userService.findRoleRequests();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Put(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { roleName: string }) {
    return await this.userService.updateUserRole(id, body.roleName);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: Partial<UserModel>) {
    return await this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.userService.remove(id);
  }
}
