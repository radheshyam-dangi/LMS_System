import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserEntity } from '../entities/user.entity'; // Path to where your actual entity class sits
import { RoleEntity } from '../entities/role.entity';
import { UserModel } from '../../types/models/user.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

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
    console.log("User find succcessfully");
    return await this.userRepository.findOne({ where: { id }, relations: ['roles'] });
  }

  async create(data: UserModel): Promise<UserEntity> {
    if (!data.password) {
      throw new BadRequestException('password are required');
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

  async login(email: string, password: string): Promise<{ user: UserEntity; accessToken: string }> {
  const user = await this.userRepository.findOne({ 
    where: { email }, 
    relations: ['roles', 'primaryRole'] // Ensure primaryRole is fetched!
  });

  if (!user || !user.password) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // 1. Verify the hashed password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // 2. Generate an access token containing the essential payload details
  const JWT_SECRET = 'your-secure-invitation-secret-key'; // Keep this safe in env variables
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles?.map(r => r.name) || [],
      primaryRole: user.primaryRole?.name || 'Trainee'
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // Remove password from returned data for security

  return { user, accessToken };
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
