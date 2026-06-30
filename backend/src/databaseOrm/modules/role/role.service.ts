import { Injectable } from '@nestjs/common';
import { RoleService as MainUserService } from "../../services/role.service";

@Injectable()
export class RoleService extends MainUserService {}