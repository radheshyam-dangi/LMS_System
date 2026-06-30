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
exports.EnrollmentEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const user_entity_1 = require("./user.entity");
const learningPath_entity_1 = require("./learningPath.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let EnrollmentEntity = class EnrollmentEntity extends base_entity_1.BaseEntity {
    enrolledAt;
    status;
    // Relation: Many enrollments belong to 1 User
    user;
    // Relation: Many enrollments link to 1 Learning Path
    learningPath;
};
exports.EnrollmentEntity = EnrollmentEntity;
__decorate([
    (0, typeorm_1.Column)({
        type: 'timestamp',
        name: 'enrolledAt',
        default: () => 'CURRENT_TIMESTAMP'
    }),
    __metadata("design:type", Date)
], EnrollmentEntity.prototype, "enrolledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'active' }),
    __metadata("design:type", String)
], EnrollmentEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Enrollment.UserId }),
    __metadata("design:type", user_entity_1.UserEntity)
], EnrollmentEntity.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => learningPath_entity_1.LearningPathEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.Enrollment.LearningPathId }),
    __metadata("design:type", learningPath_entity_1.LearningPathEntity)
], EnrollmentEntity.prototype, "learningPath", void 0);
exports.EnrollmentEntity = EnrollmentEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Enrollment)
], EnrollmentEntity);
//# sourceMappingURL=enrollment.entity.js.map