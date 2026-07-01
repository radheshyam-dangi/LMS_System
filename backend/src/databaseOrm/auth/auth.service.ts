import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';

@Injectable()
export class AuthService {
  private readonly JWT_SECRET = 'your-secure-invitation-secret-key';

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async registerInvitedUser(token: string, plainPassword: string) {
    try {
      // 1. Verify and decode the JWT token
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        email: string;
        firstName: string;
        lastName: string;
        roles: string[];      // e.g. ["Trainee", "Trainer"]
        isPrimary: string;    // e.g. "Trainer"
      };

      // 2. Prevent duplicates
      const existingUser = await this.userRepository.findOneBy({ email: decoded.email });
      if (existingUser) {
        throw new BadRequestException('User already registered.');
      }

      // 3. Look up all requested Role Entities from the Database at once
      const dbRoles = await this.roleRepository.findBy({
        name: In(decoded.roles),
      });

      if (dbRoles.length === 0) {
        throw new NotFoundException('Assigned token roles could not be found in system.');
      }

      // 4. Find which specific entity represents their primary role selection
      const primaryRoleEntity = dbRoles.find(role => role.name === decoded.isPrimary);
      if (!primaryRoleEntity) {
        throw new BadRequestException(`Primary role specification "${decoded.isPrimary}" missing from token assignment.`);
      }

      // 5. Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      // 6. Build the entity instance payload using TypeORM's constructor pattern
      const newUser = this.userRepository.create({
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        password: hashedPassword,
        roles: dbRoles,                 // Matches ManyToMany array
        primaryRole: primaryRoleEntity, // Matches ManyToOne single column relation
      });

      // 7. Persist to DB
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