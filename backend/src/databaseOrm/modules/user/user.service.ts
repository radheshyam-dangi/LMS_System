import { Injectable } from '@nestjs/common';
import { UserService as MainUserService } from '../../services/user.service';

@Injectable()
export class UserService extends MainUserService {}