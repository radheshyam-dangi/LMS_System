import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleKeyPointEntity } from '../entities/moduleKeyPoint.entity';
export declare class ModuleKeyPointEntityService extends BaseService<ModuleKeyPointEntity> {
    protected repository: Repository<ModuleKeyPointEntity>;
    constructor(datasource: DataSource);
    findKeyPointsByModule(moduleId: string): Promise<ModuleKeyPointEntity[]>;
}
