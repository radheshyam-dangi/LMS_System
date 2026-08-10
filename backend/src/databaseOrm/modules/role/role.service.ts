import { Injectable } from '@nestjs/common';
import { RoleEntityService} from "../../services/role.service";

@Injectable()
export class RoleService  {
constructor (private roleEntityService:RoleEntityService){}
}
export {RoleEntityService};