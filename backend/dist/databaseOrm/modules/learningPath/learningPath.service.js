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
exports.LearningPathEntityService = exports.LearningPathService = void 0;
const common_1 = require("@nestjs/common");
const learningPath_service_1 = require("../../services/learningPath.service");
Object.defineProperty(exports, "LearningPathEntityService", { enumerable: true, get: function () { return learningPath_service_1.LearningPathEntityService; } });
let LearningPathService = class LearningPathService {
    learningPathEntityService;
    constructor(learningPathEntityService) {
        this.learningPathEntityService = learningPathEntityService;
    }
};
exports.LearningPathService = LearningPathService;
exports.LearningPathService = LearningPathService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [learningPath_service_1.LearningPathEntityService])
], LearningPathService);
//# sourceMappingURL=learningPath.service.js.map