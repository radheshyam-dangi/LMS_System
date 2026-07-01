import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';
export declare class AuthService {
    private readonly userRepository;
    private readonly roleRepository;
    private readonly JWT_SECRET;
    constructor(userRepository: Repository<UserEntity>, roleRepository: Repository<RoleEntity>);
    registerInvitedUser(token: string, plainPassword: string): Promise<{
        message: string;
    }>;
}
