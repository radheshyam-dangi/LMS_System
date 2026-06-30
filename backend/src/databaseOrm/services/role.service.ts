import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { RoleEntity } from '../entities/role.entity'; // Path to where your actual entity class sits

@Injectable()
export class RoleService extends BaseService<RoleEntity> {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {
    // Pass the user repository up to the generic BaseService
    super(roleRepository);
  }

  // You can add specific custom queries for users here
  async findByEmail(email: string): Promise<RoleEntity | null> {
    return await this.roleRepository.findOneBy({ email } as any);
  }
}