import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleKeyPointEntity } from '../entities/moduleKeyPoint.entity';

@Injectable()
export class ModuleKeyPointEntityService extends BaseService<ModuleKeyPointEntity> {
  protected repository: Repository<ModuleKeyPointEntity>;
  constructor(
    datasource : DataSource  
  ) {
    super();
    this.repository = datasource.getRepository<ModuleKeyPointEntity>(ModuleKeyPointEntity)
  }

  async findKeyPointsByModule(moduleId: string): Promise<ModuleKeyPointEntity[]> {
    return await this.repository.find({
      where: { module: { id: moduleId } } as any,
    });
  }
}