import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';

@Injectable()
export class AuthService {
  // 🔥 FIX: Ensure matching token signature verification key matches JwtStrategy layout perfectly
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

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