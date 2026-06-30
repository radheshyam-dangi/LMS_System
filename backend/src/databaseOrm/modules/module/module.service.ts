import { Injectable } from '@nestjs/common';
import { ModuleService as MainModuleService } from '../../services/module.service';

@Injectable()
export class ModuleService extends MainModuleService {}