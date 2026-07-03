"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningPathModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const learningPath_controller_1 = require("./learningPath.controller");
const learningPath_service_1 = require("./learningPath.service");
const learningPath_entity_1 = require("../../entities/learningPath.entity");
const learningPathModule_entity_1 = require("../../entities/learningPathModule.entity");
const enrollment_entity_1 = require("../../entities/enrollment.entity");
let LearningPathModule = class LearningPathModule {
};
exports.LearningPathModule = LearningPathModule;
exports.LearningPathModule = LearningPathModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([learningPath_entity_1.LearningPathEntity, learningPathModule_entity_1.LearningPathModuleEntity, enrollment_entity_1.EnrollmentEntity])
        ],
        controllers: [learningPath_controller_1.LearningPathController],
        providers: [learningPath_service_1.LearningPathEntityService],
        exports: [learningPath_service_1.LearningPathEntityService],
    })
], LearningPathModule);
//# sourceMappingURL=learningPath.module.js.map