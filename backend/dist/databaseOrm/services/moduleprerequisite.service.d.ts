import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModulePrerequisiteEntity } from '../entities/modulePrerequisite.entity';
import { DataSource } from 'typeorm';
export declare class ModulePrerequisiteEntityService extends BaseService<ModulePrerequisiteEntity> {
    protected repository: Repository<ModulePrerequisiteEntity>;
    constructor(datasource: DataSource);
    findPrerequisitesForModule(moduleId: string): Promise<ModulePrerequisiteEntity[]>;
}
