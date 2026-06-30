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
exports.LessonEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const module_entity_1 = require("./module.entity");
const assignment_entity_1 = require("./assignment.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let LessonEntity = class LessonEntity extends base_entity_1.BaseEntity {
    title;
    description;
    durationMinutes;
    displayOrder;
    // Relation: Lesson belongs to a Module
    module;
    // Relation: One Lesson has many Assignments
    assignments;
};
exports.LessonEntity = LessonEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], LessonEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], LessonEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'duration_minutes', nullable: true }),
    __metadata("design:type", Number)
], LessonEntity.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'display_order', nullable: true }),
    __metadata("design:type", Number)
], LessonEntity.prototype, "displayOrder", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => module_entity_1.ModuleEntity, (module) => module.lessons),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Lesson.ModuleId }),
    __metadata("design:type", module_entity_1.ModuleEntity)
], LessonEntity.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => assignment_entity_1.AssignmentEntity, (assignment) => assignment.lesson),
    __metadata("design:type", Array)
], LessonEntity.prototype, "assignments", void 0);
exports.LessonEntity = LessonEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Lesson)
], LessonEntity);
//# sourceMappingURL=lesson.entity.js.map