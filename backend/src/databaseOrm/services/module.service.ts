import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';
import { DataSource } from 'typeorm/browser';

@Injectable()
export class ModuleEntityService extends BaseService<ModuleEntity> {
  protected repository: Repository<ModuleEntity>;
  constructor(
  datasource:DataSource  
  ) {
    super();
    this.repository = datasource.getRepository<ModuleEntity>(ModuleEntity)
  }

  /**
   * Custom Query Example: Fetch parent modules along with their submodules
   */
  async findModulesWithSubModules(): Promise<ModuleEntity[]> {
    return await this.repository.find({
      relations: ['subModules', 'lessons'],
    });
  }
}