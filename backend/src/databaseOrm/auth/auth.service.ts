import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';

@Injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  /**
   * 🔑 USER LOGIN: Authenticates user credentials and returns signed JWT with role claim
   */
  async login(dto: { email: string; password: string; activeRole?: string }) {
    // 1. Fetch user from database with role relations loaded
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['roles', 'primaryRole'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password credentials.');
    }

    // 2. Validate password hash
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password credentials.');
    }

    // 3. Resolve active role (Priority: requested activeRole -> primaryRole -> first role)
    const primaryRoleName = user.primaryRole?.name || 'Trainee';
    const roleNamesList = user.roles?.map((r) => r.name) || [primaryRoleName];

    let currentRole = primaryRoleName;
    if (dto.activeRole && roleNamesList.includes(dto.activeRole)) {
      currentRole = dto.activeRole;
    }

    // 4. Construct JWT Payload (Includes explicit role claims needed by RolesGuard)
    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: currentRole,             // 👈 CRITICAL: Active role string
      primaryRole: primaryRoleName,  // 👈 Primary role fallback
      activeRole: currentRole,
      roles: roleNamesList,          // 👈 List of all allowed roles
    };

    // 5. Sign token with secret
    const accessToken = jwt.sign(payload, this.JWT_SECRET, { expiresIn: '1d' });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        primaryRole: primaryRoleName,
        roles: roleNamesList,
        activeRole: currentRole,
      },
    };
  }

  /**
   * 📩 REGISTER INVITED USER: Completes registration via invite token
   */
  async registerInvitedUser(token: string, plainPassword: string) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        email: string;
        firstName: string;
        lastName: string;
        roles: string[]; 
        isPrimary: string; 
      };

      const existingUser = await this.userRepository.findOneBy({ email: decoded.email });
      if (existingUser) {
        throw new BadRequestException('User already registered.');
      }

      const dbRoles = await this.roleRepository.findBy({
        name: In(decoded.roles),
      });

      if (dbRoles.length === 0) {
        throw new NotFoundException('Assigned token roles could not be found in system.');
      }

      const primaryRoleEntity = dbRoles.find(role => role.name === decoded.isPrimary);
      if (!primaryRoleEntity) {
        throw new BadRequestException(`Primary role specification "${decoded.isPrimary}" missing from token assignment.`);
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      const newUser = this.userRepository.create({
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        password: hashedPassword,
        roles: dbRoles, 
        primaryRole: primaryRoleEntity, 
      });

      await this.userRepository.save(newUser);
      return { message: 'Account successfully created' };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Invitation token is invalid or has expired');
    }
  }
}