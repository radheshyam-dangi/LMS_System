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
exports.SubmissionEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const assignment_entity_1 = require("./assignment.entity");
const user_entity_1 = require("./user.entity");
const evaluation_entity_1 = require("./evaluation.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let SubmissionEntity = class SubmissionEntity extends base_entity_1.BaseEntity {
    submissionType;
    githubUrl;
    liveUrl;
    notes;
    status;
    submittedAt;
    assignment;
    user;
    evaluations;
};
exports.SubmissionEntity = SubmissionEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'submissionType', nullable: false }),
    __metadata("design:type", String)
], SubmissionEntity.prototype, "submissionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'githubUrl', nullable: true }),
    __metadata("design:type", String)
], SubmissionEntity.prototype, "githubUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'liveUrl', nullable: true }),
    __metadata("design:type", String)
], SubmissionEntity.prototype, "liveUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], SubmissionEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'pending' }),
    __metadata("design:type", String)
], SubmissionEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', name: 'submittedAt', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], SubmissionEntity.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => assignment_entity_1.AssignmentEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Submission.AssignmentId }),
    __metadata("design:type", assignment_entity_1.AssignmentEntity)
], SubmissionEntity.prototype, "assignment", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Submission.UserId }),
    __metadata("design:type", user_entity_1.UserEntity)
], SubmissionEntity.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => evaluation_entity_1.EvaluationEntity, (evaluation) => evaluation.submission),
    __metadata("design:type", Array)
], SubmissionEntity.prototype, "evaluations", void 0);
exports.SubmissionEntity = SubmissionEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Submission)
], SubmissionEntity);
//# sourceMappingURL=submission.entity.js.map