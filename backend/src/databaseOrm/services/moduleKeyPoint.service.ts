import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleKeyPointEntity } from '../entities/moduleKeyPoint.entity';

@Injectable()
export class ModuleKeyPointService extends BaseService<ModuleKeyPointEntity> {
  constructor(
    @InjectRepository(ModuleKeyPointEntity)
    private readonly moduleKeyPointRepository: Repository<ModuleKeyPointEntity>,
  ) {
    super(moduleKeyPointRepository);
  }

  async findKeyPointsByModule(moduleId: string): Promise<ModuleKeyPointEntity[]> {
    return await this.moduleKeyPointRepository.find({
      where: { module: { id: moduleId } } as any,
    });
  }
}