import { Injectable } from '@nestjs/common';
import { ModuleEntityService } from '../../services/module.service';

@Injectable()
export class ModuleService {
    constructor(private moduleEntityService:ModuleEntityService){}
}
export {ModuleEntityService}