import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserEntity } from '../entities/user.entity'; // Path to where your actual entity class sits
import { RoleEntity } from '../entities/role.entity';
import { UserModel } from '../../types/models/user.model';

const SYSTEM_ROLES = ['Admin', 'Trainee', 'Trainer'] as const;
type SystemRole = (typeof SYSTEM_ROLES)[number];

@Injectable()
export class UserService extends BaseService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {
    // Pass the user repository up to the generic BaseService
    super(userRepository);
  }

  async findAll(): Promise<UserEntity[]> {
    return await this.userRepository.find({ relations: ['roles'] });
  }

  async findOne(id: any): Promise<UserEntity | null> {
    return await this.userRepository.findOne({ where: { id }, relations: ['roles'] });
  }

  async create(data: UserModel): Promise<UserEntity> {
    if (!data.email || !data.password) {
      throw new BadRequestException('Email and password are required');
    }

    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User already exists with this email');
    }

    await this.ensureSystemRoles();
    const userCount = await this.userRepository.count();
    const roleName: SystemRole = userCount === 0 ? 'Admin' : 'Trainee';
    const role = await this.getRoleByName(roleName);

    const user = this.userRepository.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      roles: [role],
    });

    return await this.userRepository.save(user);
  }

  // You can add specific custom queries for users here
  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({ where: { email }, relations: ['roles'] });
  }

  async login(email: string, password: string): Promise<UserEntity> {
    const user = await this.findByEmail(email);
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  async findRoleRequests(): Promise<UserEntity[]> {
    const users = await this.findAll();

    return users.filter((user) =>
      user.roles?.some((role) => role.name === 'Trainee'),
    );
  }

  async updateUserRole(userId: string, roleName: string): Promise<UserEntity> {
    if (!SYSTEM_ROLES.includes(roleName as SystemRole)) {
      throw new BadRequestException('Role must be Admin, Trainee, or Trainer');
    }

    await this.ensureSystemRoles();

    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.getRoleByName(roleName as SystemRole);
    user.roles = [role];

    return await this.userRepository.save(user);
  }

  private async ensureSystemRoles(): Promise<void> {
    for (const name of SYSTEM_ROLES) {
      const existingRole = await this.roleRepository.findOneBy({ name });
      if (!existingRole) {
        await this.roleRepository.save(this.roleRepository.create({ name }));
      }
    }
  }

  private async getRoleByName(name: SystemRole): Promise<RoleEntity> {
    const role = await this.roleRepository.findOneBy({ name });
    if (!role) {
      throw new NotFoundException(`${name} role not found`);
    }

    return role;
  }
}
