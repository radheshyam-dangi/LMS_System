import { UserEntityService } from './user.service';
import type { UserModel } from '../../../types/models/user.model';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserEntityService);
    findAll(): Promise<import("../../entities/user.entity").UserEntity[]>;
    signup(signUpDto: UserModel): Promise<import("../../entities/user.entity").UserEntity>;
    login(body: Pick<UserModel, 'email' | 'password'>): Promise<{
        user: import("../../entities/user.entity").UserEntity;
        accessToken: string;
    }>;
    roleRequests(): Promise<import("../../entities/user.entity").UserEntity[]>;
    findOne(id: string): Promise<import("../../entities/user.entity").UserEntity | null>;
    updateRole(id: string, body: {
        roleName: string;
    }): Promise<import("../../entities/user.entity").UserEntity>;
    update(id: string, updateUserDto: Partial<UserModel>): Promise<import("../../entities/user.entity").UserEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
