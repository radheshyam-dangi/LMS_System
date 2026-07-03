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
exports.ModuleKeyPointEntityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const base_service_1 = require("./base.service");
const moduleKeyPoint_entity_1 = require("../entities/moduleKeyPoint.entity");
let ModuleKeyPointEntityService = class ModuleKeyPointEntityService extends base_service_1.BaseService {
    repository;
    constructor(datasource) {
        super();
        this.repository = datasource.getRepository(moduleKeyPoint_entity_1.ModuleKeyPointEntity);
    }
    async findKeyPointsByModule(moduleId) {
        return await this.repository.find({
            where: { module: { id: moduleId } },
        });
    }
};
exports.ModuleKeyPointEntityService = ModuleKeyPointEntityService;
exports.ModuleKeyPointEntityService = ModuleKeyPointEntityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ModuleKeyPointEntityService);
//# sourceMappingURL=moduleKeyPoint.service.js.map