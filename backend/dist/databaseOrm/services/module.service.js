"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleEntityService = void 0;
const common_1 = require("@nestjs/common");
const base_service_1 = require("./base.service");
const module_entity_1 = require("../entities/module.entity");
const typeorm_1 = require("typeorm");
let ModuleEntityService = class ModuleEntityService extends base_service_1.BaseService {
    repository;
    constructor(datasource) {
        super();
        this.repository = datasource.getRepository(module_entity_1.ModuleEntity);
    }
    /**
     * Custom Query Example: Fetch parent modules along with their submodules
     */
    async findModulesWithSubModules() {
        return await this.repository.find({
            relations: ['subModules', 'lessons'],
        });
    }
};
exports.ModuleEntityService = ModuleEntityService;
exports.ModuleEntityService = ModuleEntityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ModuleEntityService);
//# sourceMappingURL=module.service.js.map