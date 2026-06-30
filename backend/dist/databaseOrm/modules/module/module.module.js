"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const module_controller_1 = require("./module.controller");
const module_service_1 = require("./module.service");
const module_entity_1 = require("../../entities/module.entity");
const moduleKeyPoint_entity_1 = require("../../entities/moduleKeyPoint.entity");
const modulePrerequisite_entity_1 = require("../../entities/modulePrerequisite.entity");
let ModuleModule = class ModuleModule {
};
exports.ModuleModule = ModuleModule;
exports.ModuleModule = ModuleModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([module_entity_1.ModuleEntity, moduleKeyPoint_entity_1.ModuleKeyPointEntity, modulePrerequisite_entity_1.ModulePrerequisiteEntity])
        ],
        controllers: [module_controller_1.ModuleController],
        providers: [module_service_1.ModuleService],
        exports: [module_service_1.ModuleService]
    })
], ModuleModule);
//# sourceMappingURL=module.module.js.map