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
exports.LearningPathEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const user_entity_1 = require("./user.entity");
const module_entity_1 = require("./module.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let LearningPathEntity = class LearningPathEntity extends base_entity_1.BaseEntity {
    title;
    description;
    status;
    // Relation: Many learning paths can be created by 1 User
    createdBy;
    // Relation: One-to-Many with Modules via your mapped ModuleEntity configuration
    modules;
};
exports.LearningPathEntity = LearningPathEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], LearningPathEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], LearningPathEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }) // maps back to your DBML enum type
    ,
    __metadata("design:type", String)
], LearningPathEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.LearningPath.CreatedBy }),
    __metadata("design:type", user_entity_1.UserEntity)
], LearningPathEntity.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => module_entity_1.ModuleEntity, (module) => module.learningPath),
    __metadata("design:type", Array)
], LearningPathEntity.prototype, "modules", void 0);
exports.LearningPathEntity = LearningPathEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.LearningPath)
], LearningPathEntity);
//# sourceMappingURL=learningPath.entity.js.map