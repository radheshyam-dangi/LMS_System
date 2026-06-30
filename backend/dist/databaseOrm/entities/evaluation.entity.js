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
exports.EvaluationEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const submission_entity_1 = require("./submission.entity");
const user_entity_1 = require("./user.entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
const entity_1 = require("../../constants/entity");
let EvaluationEntity = class EvaluationEntity extends base_entity_1.BaseEntity {
    technicalScore;
    architectureScore;
    problemSolvingScore;
    documentationScore;
    overallScore;
    feedback;
    submission;
    evaluator;
};
exports.EvaluationEntity = EvaluationEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'technicalScore', default: 0 }),
    __metadata("design:type", Number)
], EvaluationEntity.prototype, "technicalScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'architectureScore', default: 0 }),
    __metadata("design:type", Number)
], EvaluationEntity.prototype, "architectureScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'problemSolvingScore', default: 0 }),
    __metadata("design:type", Number)
], EvaluationEntity.prototype, "problemSolvingScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'documentationScore', default: 0 }),
    __metadata("design:type", Number)
], EvaluationEntity.prototype, "documentationScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'overallScore', default: 0 }),
    __metadata("design:type", Number)
], EvaluationEntity.prototype, "overallScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: false }),
    __metadata("design:type", String)
], EvaluationEntity.prototype, "feedback", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => submission_entity_1.SubmissionEntity, (submission) => submission.evaluations, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Evaluation.SubmissionId }),
    __metadata("design:type", submission_entity_1.SubmissionEntity)
], EvaluationEntity.prototype, "submission", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Evaluation.EvaluatorId }),
    __metadata("design:type", user_entity_1.UserEntity)
], EvaluationEntity.prototype, "evaluator", void 0);
exports.EvaluationEntity = EvaluationEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Evaluation)
], EvaluationEntity);
//# sourceMappingURL=evaluation.entity.js.map