import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository, ILike } from 'typeorm';
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
    this.roleRepository = datasource.getRepository<RoleEntity>(RoleEntity);
  }

  async findAll(): Promise<UserEntity[]> {
    return await this.repository.find({ relations: ['roles', 'primaryRole'] });
  }

  async findOne(id: any): Promise<UserEntity | null> {
    return await this.repository.findOne({ where: { id }, relations: ['roles', 'primaryRole'] });
  }

  async create(data: UserModel & { roles?: string[]; primaryRole?: string }): Promise<UserEntity> {
    if (!data.password) {
      throw new BadRequestException('Password is required');
    }

    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User already exists with this email');
    }

    await this.ensureSystemRoles();

    // 1. Resolve the array of roles sent in the payload body
    const assignedRoles: RoleEntity[] = [];
    if (data.roles && data.roles.length > 0) {
      for (const rName of data.roles) {
        const rEntity = await this.getRoleByName(rName as SystemRole);
        assignedRoles.push(rEntity);
      }
    } else {
      // Fallback if no roles are passed
      const userCount = await this.repository.count();
      const defaultRoleName: SystemRole = userCount === 0 ? 'Admin' : 'Trainee';
      const defaultRole = await this.getRoleByName(defaultRoleName);
      assignedRoles.push(defaultRole);
    }

    // 2. Resolve the targeted Primary Role relation
    let primaryRoleEntity: RoleEntity | undefined;
    if (data.primaryRole) {
      primaryRoleEntity = await this.getRoleByName(data.primaryRole as SystemRole);
    } else {
      primaryRoleEntity = assignedRoles[0]; // Fallback to first role
    }

    // 3. Securely hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    // 4. Instantiate the record
    const user = this.repository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      roles: assignedRoles,
      primaryRole: primaryRoleEntity, 
    });

    return await this.repository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.repository.findOne({ where: { email }, relations: ['roles', 'primaryRole'] });
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

    const JWT_SECRET = process.env.JWT_SECRET || 'secret-key'; 
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

  /**
   * 🌟 FETCH ALL USERS WHO POSSESS A SPECIFIC ROLE
   * Filters across multi-role setups (e.g. users having 'Trainee' role anywhere in their list)
   */
  async findUsersByRole(role: string): Promise<UserEntity[]> {
    return await this.repository.find({
      relations: ['roles', 'primaryRole'],
      where: [
        {
          roles: {
            name: ILike(role), // Matches role name regardless of casing in roles array
          },
        },
        {
          primaryRole: {
            name: ILike(role), // Fallback check against primaryRole relation
          },
        },
      ],
    });
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