import { ModuleService } from './module.service';
import type { ModuleModel } from '../../../types/models/module.model';
export declare class ModuleController {
    private readonly moduleService;
    constructor(moduleService: ModuleService);
    create(dto: ModuleModel): Promise<import("../../entities/module.entity").ModuleEntity>;
    findAll(): Promise<import("../../entities/module.entity").ModuleEntity[]>;
    findOne(id: string): Promise<import("../../entities/module.entity").ModuleEntity | null>;
    update(id: string, dto: Partial<ModuleModel>): Promise<import("../../entities/module.entity").ModuleEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
