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
exports.ModuleEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const user_entity_1 = require("./user.entity");
const learningPath_entity_1 = require("./learningPath.entity");
const lesson_entity_1 = require("./lesson.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let ModuleEntity = class ModuleEntity extends base_entity_1.BaseEntity {
    title;
    description;
    difficultyLevel;
    status;
    // Self-referencing relationship (parent_id points back to Module)
    parent;
    subModules;
    // Relation: Many modules belong to a LearningPath
    learningPath;
    // Relation: Created By User
    createdBy;
    // Relation: One Module has Many Lessons
    lessons;
};
exports.ModuleEntity = ModuleEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], ModuleEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ModuleEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'difficulty_level', nullable: true }),
    __metadata("design:type", String)
], ModuleEntity.prototype, "difficultyLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ModuleEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ModuleEntity, (module) => module.subModules, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Module.ParentId }),
    __metadata("design:type", ModuleEntity)
], ModuleEntity.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ModuleEntity, (module) => module.parent),
    __metadata("design:type", Array)
], ModuleEntity.prototype, "subModules", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => learningPath_entity_1.LearningPathEntity, (lp) => lp.modules),
    __metadata("design:type", learningPath_entity_1.LearningPathEntity)
], ModuleEntity.prototype, "learningPath", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Module.CreatedBy }),
    __metadata("design:type", user_entity_1.UserEntity)
], ModuleEntity.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => lesson_entity_1.LessonEntity, (lesson) => lesson.module),
    __metadata("design:type", Array)
], ModuleEntity.prototype, "lessons", void 0);
exports.ModuleEntity = ModuleEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Module)
], ModuleEntity);
//# sourceMappingURL=module.entity.js.map