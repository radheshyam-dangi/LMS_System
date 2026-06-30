import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { ModulePrerequisiteEntity } from '../entities/modulePrerequisite.entity';
export declare class ModulePrerequisiteService extends BaseService<ModulePrerequisiteEntity> {
    private readonly modulePrerequisiteRepository;
    constructor(modulePrerequisiteRepository: Repository<ModulePrerequisiteEntity>);
    findPrerequisitesForModule(moduleId: string): Promise<ModulePrerequisiteEntity[]>;
}
