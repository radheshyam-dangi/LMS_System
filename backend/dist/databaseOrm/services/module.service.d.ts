import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';
export declare class ModuleService extends BaseService<ModuleEntity> {
    private readonly moduleRepository;
    constructor(moduleRepository: Repository<ModuleEntity>);
    /**
     * Custom Query Example: Fetch parent modules along with their submodules
     */
    findModulesWithSubModules(): Promise<ModuleEntity[]>;
}
