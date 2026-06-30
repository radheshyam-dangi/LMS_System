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
exports.AssignmentEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const lesson_entity_1 = require("./lesson.entity");
const user_entity_1 = require("./user.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let AssignmentEntity = class AssignmentEntity extends base_entity_1.BaseEntity {
    title;
    description;
    instructions;
    difficultyLevel;
    assignmentType;
    maxScore;
    dueDate;
    // Relation: Assignment belongs to a Lesson
    lesson;
    // Relation: Assignment created by User
    createdBy;
};
exports.AssignmentEntity = AssignmentEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], AssignmentEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AssignmentEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AssignmentEntity.prototype, "instructions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'difficulty_level', nullable: true }),
    __metadata("design:type", String)
], AssignmentEntity.prototype, "difficultyLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'assignment_type', nullable: true }),
    __metadata("design:type", String)
], AssignmentEntity.prototype, "assignmentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'max_score', nullable: true }),
    __metadata("design:type", Number)
], AssignmentEntity.prototype, "maxScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', name: 'due_date', nullable: true }),
    __metadata("design:type", Date)
], AssignmentEntity.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => lesson_entity_1.LessonEntity, (lesson) => lesson.assignments),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Assignment.LessonId }),
    __metadata("design:type", lesson_entity_1.LessonEntity)
], AssignmentEntity.prototype, "lesson", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Assignment.CreatedBy }),
    __metadata("design:type", user_entity_1.UserEntity)
], AssignmentEntity.prototype, "createdBy", void 0);
exports.AssignmentEntity = AssignmentEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Assignment)
], AssignmentEntity);
//# sourceMappingURL=assignment.entity.js.map