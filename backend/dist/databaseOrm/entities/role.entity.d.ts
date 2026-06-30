import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
export declare class RoleEntity extends BaseEntity {
    name: string;
    users: UserEntity[];
}
