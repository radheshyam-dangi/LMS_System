import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModulePrerequisiteEntity } from '../entities/modulePrerequisite.entity';

@Injectable()
export class ModulePrerequisiteService extends BaseService<ModulePrerequisiteEntity> {
  constructor(
    @InjectRepository(ModulePrerequisiteEntity)
    private readonly modulePrerequisiteRepository: Repository<ModulePrerequisiteEntity>,
  ) {
    super(modulePrerequisiteRepository);
  }

  async findPrerequisitesForModule(moduleId: string): Promise<ModulePrerequisiteEntity[]> {
    return await this.modulePrerequisiteRepository.find({
      where: { module: { id: moduleId } } as any,
      relations: ['prerequisiteModule'],
    });
  }
}