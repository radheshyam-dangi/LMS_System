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
exports.LearningPathModuleEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const learningPath_entity_1 = require("./learningPath.entity");
const module_entity_1 = require("./module.entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
const entity_1 = require("../../constants/entity");
let LearningPathModuleEntity = class LearningPathModuleEntity extends base_entity_1.BaseEntity {
    displayOrder;
    // Relationships
    learningPath;
    module;
};
exports.LearningPathModuleEntity = LearningPathModuleEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'displayOrder', default: 0 }),
    __metadata("design:type", Number)
], LearningPathModuleEntity.prototype, "displayOrder", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => learningPath_entity_1.LearningPathEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.LearningPathModule.LearningPathId }),
    __metadata("design:type", learningPath_entity_1.LearningPathEntity)
], LearningPathModuleEntity.prototype, "learningPath", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => module_entity_1.ModuleEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.LearningPathModule.ModuleId }),
    __metadata("design:type", module_entity_1.ModuleEntity)
], LearningPathModuleEntity.prototype, "module", void 0);
exports.LearningPathModuleEntity = LearningPathModuleEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.LearningPathModule)
], LearningPathModuleEntity);
//# sourceMappingURL=learningPathModule.entity.js.map