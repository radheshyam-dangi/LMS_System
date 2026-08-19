import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
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
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 🔒 LOGIN: Authenticates user and generates short-lived access & long-lived refresh tokens
   */
  async login(dto: { email: string; password: string; activeRole?: string }) {
    // 1. Find user (with roles and primary role)
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
      role: currentRole, // 👈 CRITICAL: Active role string
      primaryRole: primaryRoleName, // 👈 Primary role fallback
      activeRole: currentRole,
      roles: roleNamesList, // 👈 List of all allowed roles
    };

    // 5. Sign tokens with JwtService
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: this.JWT_SECRET,
    });
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      { expiresIn: '7d', secret: this.JWT_SECRET },
    );

    return {
      accessToken,
      refreshToken,
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
   * 🔄 REFRESH: Generates a new access token using a valid refresh token
   */
  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.JWT_SECRET,
      });
      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
        relations: ['roles', 'primaryRole'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      const primaryRoleName = user.primaryRole?.name || 'Trainee';
      const roleNamesList = user.roles?.map((r) => r.name) || [primaryRoleName];

      const payload = {
        sub: user.id,
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: primaryRoleName,
        primaryRole: primaryRoleName,
        activeRole: primaryRoleName,
        roles: roleNamesList,
      };

      const newAccessToken = await this.jwtService.signAsync(payload, {
        expiresIn: '15m',
        secret: this.JWT_SECRET,
      });
      const newRefreshToken = await this.jwtService.signAsync(
        { sub: user.id },
        { expiresIn: '7d', secret: this.JWT_SECRET },
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  /**
   * 📩 REGISTER INVITED USER: Completes registration via invite token
   */
  async registerInvitedUser(token: string, plainPassword: string) {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.JWT_SECRET,
      });

      const existingUser = await this.userRepository.findOneBy({
        email: decoded.email,
      });
      if (existingUser) {
        throw new BadRequestException('User already registered.');
      }

      const dbRoles = await this.roleRepository.findBy({
        name: In(decoded.roles),
      });

      if (dbRoles.length === 0) {
        throw new NotFoundException(
          'Assigned token roles could not be found in system.',
        );
      }

      const primaryRoleEntity = dbRoles.find(
        (role) => role.name === decoded.isPrimary,
      );
      if (!primaryRoleEntity) {
        throw new BadRequestException(
          `Primary role specification "${decoded.isPrimary}" missing from token assignment.`,
        );
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
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      //token is expired so we need to refresh the token
      //generate new token
      
      throw new BadRequestException(
        'Invitation token is invalid or has expired',
      );
    }
  }
}
