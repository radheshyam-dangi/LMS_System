import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModuleEntity } from '../entities/module.entity';
import { DataSource } from 'typeorm';
export declare class ModuleEntityService extends BaseService<ModuleEntity> {
    protected repository: Repository<ModuleEntity>;
    constructor(datasource: DataSource);
    /**
     * Custom Query Example: Fetch parent modules along with their submodules
     */
    findModulesWithSubModules(): Promise<ModuleEntity[]>;
}
