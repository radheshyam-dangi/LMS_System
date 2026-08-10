import { Injectable } from '@nestjs/common';

import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModulePrerequisiteEntity } from '../entities/modulePrerequisite.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class ModulePrerequisiteEntityService extends BaseService<ModulePrerequisiteEntity> {
  protected repository: Repository<ModulePrerequisiteEntity>;
  constructor(
    datasource:DataSource
  ) {
    super();
    this.repository = datasource.getRepository<ModulePrerequisiteEntity>(ModulePrerequisiteEntity)
  }

  async findPrerequisitesForModule(moduleId: string): Promise<ModulePrerequisiteEntity[]> {
    return await this.repository.find({
      where: { module: { id: moduleId } } as any,
      relations: ['prerequisiteModule'],
    });
  }
}