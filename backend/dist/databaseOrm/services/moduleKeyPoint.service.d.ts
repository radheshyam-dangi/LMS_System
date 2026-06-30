import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleKeyPointEntity } from '../entities/moduleKeyPoint.entity';
export declare class ModuleKeyPointService extends BaseService<ModuleKeyPointEntity> {
    private readonly moduleKeyPointRepository;
    constructor(moduleKeyPointRepository: Repository<ModuleKeyPointEntity>);
    findKeyPointsByModule(moduleId: string): Promise<ModuleKeyPointEntity[]>;
}
