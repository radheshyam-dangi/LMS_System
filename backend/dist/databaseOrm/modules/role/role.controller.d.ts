import { RoleEntityService } from "./role.service";
import type { RoleModel } from "../../../types/models/role.model";
export declare class RoleConttroller {
    private readonly roleService;
    constructor(roleService: RoleEntityService);
    create(createUserDto: RoleModel): Promise<import("../../entities/role.entity").RoleEntity>;
    findAll(): Promise<import("../../entities/role.entity").RoleEntity[]>;
    findOne(id: string): Promise<import("../../entities/role.entity").RoleEntity | null>;
    update(id: string, updateUserDto: Partial<RoleModel>): Promise<import("../../entities/role.entity").RoleEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
