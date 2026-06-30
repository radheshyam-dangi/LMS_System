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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningPathController = void 0;
const common_1 = require("@nestjs/common");
const learningPath_service_1 = require("./learningPath.service");
const routePaths_1 = require("../../../constants/routePaths");
let LearningPathController = class LearningPathController {
    learningPathService;
    constructor(learningPathService) {
        this.learningPathService = learningPathService;
    }
    async create(dto) {
        return await this.learningPathService.create(dto);
    }
    async findAll() {
        return await this.learningPathService.findAll();
    }
    async findOne(id) {
        return await this.learningPathService.findOne(id);
    }
    async update(id, dto) {
        return await this.learningPathService.update(id, dto);
    }
    async remove(id) {
        return await this.learningPathService.remove(id);
    }
};
exports.LearningPathController = LearningPathController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LearningPathController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LearningPathController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LearningPathController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LearningPathController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LearningPathController.prototype, "remove", null);
exports.LearningPathController = LearningPathController = __decorate([
    (0, common_1.Controller)(routePaths_1.RoutePaths.LearningPaths),
    __metadata("design:paramtypes", [learningPath_service_1.LearningPathService])
], LearningPathController);
//# sourceMappingURL=learningPath.controller.js.map