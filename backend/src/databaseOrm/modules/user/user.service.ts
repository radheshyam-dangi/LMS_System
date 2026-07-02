import { Injectable } from '@nestjs/common';
import { UserEntityService } from '../../services/user.service';

@Injectable()
export class UserService {
    constructor (
        private userEntityService: UserEntityService
    ) {}
}

export { UserEntityService };
