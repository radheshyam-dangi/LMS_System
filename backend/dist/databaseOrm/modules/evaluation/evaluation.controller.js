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
exports.EvaluationController = void 0;
const common_1 = require("@nestjs/common");
const evaluation_service_1 = require("./evaluation.service");
const routePaths_1 = require("../../../constants/routePaths");
let EvaluationController = class EvaluationController {
    evaluationService;
    constructor(evaluationService) {
        this.evaluationService = evaluationService;
    }
    async create(dto) {
        return await this.evaluationService.create(dto);
    }
    async findAll() {
        return await this.evaluationService.findAll();
    }
    async findOne(id) {
        return await this.evaluationService.findOne(id);
    }
    async update(id, dto) {
        return await this.evaluationService.update(id, dto);
    }
    async remove(id) {
        return await this.evaluationService.remove(id);
    }
};
exports.EvaluationController = EvaluationController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "remove", null);
exports.EvaluationController = EvaluationController = __decorate([
    (0, common_1.Controller)(routePaths_1.RoutePaths.Evaluations),
    __metadata("design:paramtypes", [evaluation_service_1.EvaluationService])
], EvaluationController);
//# sourceMappingURL=evaluation.controller.js.map