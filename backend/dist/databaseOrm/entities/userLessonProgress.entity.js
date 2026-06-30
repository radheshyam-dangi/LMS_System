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
exports.UserLessonProgressEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const user_entity_1 = require("./user.entity");
const lesson_entity_1 = require("./lesson.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let UserLessonProgressEntity = class UserLessonProgressEntity extends base_entity_1.BaseEntity {
    completedAt;
    user;
    lesson;
};
exports.UserLessonProgressEntity = UserLessonProgressEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', name: 'completedAt', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], UserLessonProgressEntity.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.UserLessonProgress.UserId }),
    __metadata("design:type", user_entity_1.UserEntity)
], UserLessonProgressEntity.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => lesson_entity_1.LessonEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.UserLessonProgress.LessonId }),
    __metadata("design:type", lesson_entity_1.LessonEntity)
], UserLessonProgressEntity.prototype, "lesson", void 0);
exports.UserLessonProgressEntity = UserLessonProgressEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.UserLessonProgress)
], UserLessonProgressEntity);
//# sourceMappingURL=userLessonProgress.entity.js.map