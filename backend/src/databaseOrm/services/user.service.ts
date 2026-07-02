import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserEntity } from '../entities/user.entity'; 
import { RoleEntity } from '../entities/role.entity';
import { UserModel } from '../../types/models/user.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const SYSTEM_ROLES = ['Admin', 'Trainee', 'Trainer'] as const;
type SystemRole = (typeof SYSTEM_ROLES)[number];

@Injectable()
export class UserEntityService extends BaseService<UserEntity> {
  protected repository: Repository<UserEntity>;
  protected roleRepository: Repository<RoleEntity>;

  constructor(datasource: DataSource) {
    super();
    this.repository = datasource.getRepository<UserEntity>(UserEntity);
    // Properly initializing the Role repository
    this.roleRepository = datasource.getRepository<RoleEntity>(RoleEntity);
  }

  async findAll(): Promise<UserEntity[]> {
    return await this.repository.find({ relations: ['roles'] });
  }

  async findOne(id: any): Promise<UserEntity | null> {
    return await this.repository.findOne({ where: { id }, relations: ['roles'] });
  }

  async create(data: UserModel): Promise<UserEntity> {
    if (!data.password) {
      throw new BadRequestException('Password is required');
    }

    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User already exists with this email');
    }

    await this.ensureSystemRoles();
    const userCount = await this.repository.count();
    const roleName: SystemRole = userCount === 0 ? 'Admin' : 'Trainee';
    const role = await this.getRoleByName(roleName);

    // CRITICAL FIX: Hash the password before saving!
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    const user = this.repository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      roles: [role],
    });

    return await this.repository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.repository.findOne({ where: { email }, relations: ['roles'] });
  }

  async login(email: string, password: string): Promise<{ user: UserEntity; accessToken: string }> {
    const user = await this.repository.findOne({ 
      where: { email }, 
      relations: ['roles', 'primaryRole'] 
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // TODO: Move this to an environment variable (e.g., process.env.JWT_SECRET)
    const JWT_SECRET = 'your-secure-invitation-secret-key'; 
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
    return { user, accessToken };
  }

  async findRoleRequests(): Promise<UserEntity[]> {
    const users = await this.findAll();
    return users.filter((user) =>
      user.roles?.some((role) => role.name === 'Trainee'),
    );
  }

  async updateUserRole(userId: any, roleName: string): Promise<UserEntity> {
    if (!SYSTEM_ROLES.includes(roleName as SystemRole)) {
      throw new BadRequestException('Role must be Admin, Trainee, or Trainer');
    }

    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.getRoleByName(roleName as SystemRole);
    user.roles = [role];

    return await this.repository.save(user);
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