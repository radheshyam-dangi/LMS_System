import { BaseEntity } from './base.entity';
import { RoleEntity } from './role.entity';
export declare class UserEntity extends BaseEntity {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    roles: RoleEntity[];
}
