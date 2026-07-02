import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { RoleEntity } from '../entities/role.entity'; // Path to where your actual entity class sits
import { DataSource } from 'typeorm/browser';

@Injectable()
export class RoleEntityService extends BaseService<RoleEntity> {
  protected repository: Repository<RoleEntity>;
  constructor(
    datasource:DataSource
    ) {
    // Pass the user repository up to the generic BaseService
    super();
    this.repository = datasource.getRepository<RoleEntity>(RoleEntity)
  }

  // You can add specific custom queries for users here
  async findByEmail(email: string): Promise<RoleEntity | null> {
    return await this.repository.findOneBy({ email } as any);
  }
}