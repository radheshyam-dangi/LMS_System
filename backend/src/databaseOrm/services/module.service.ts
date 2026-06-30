import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';

@Injectable()
export class ModuleService extends BaseService<ModuleEntity> {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
  ) {
    super(moduleRepository);
  }

  /**
   * Custom Query Example: Fetch parent modules along with their submodules
   */
  async findModulesWithSubModules(): Promise<ModuleEntity[]> {
    return await this.moduleRepository.find({
      relations: ['subModules', 'lessons'],
    });
  }
}