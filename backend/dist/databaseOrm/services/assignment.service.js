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
exports.AssignmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const base_service_1 = require("./base.service");
const assignment_entity_1 = require("../entities/assignment.entity");
let AssignmentService = class AssignmentService extends base_service_1.BaseService {
    assignmentRepository;
    constructor(assignmentRepository) {
        // Pass the injected repository up to the generic BaseService handler
        super(assignmentRepository);
        this.assignmentRepository = assignmentRepository;
    }
    /**
     * Example Custom Query: Find all assignments belonging to a specific lesson
     */
    async findByLessonId(lessonId) {
        return await this.assignmentRepository.find({
            where: {
                lesson: { id: lessonId }
            }
        });
    }
};
exports.AssignmentService = AssignmentService;
exports.AssignmentService = AssignmentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(assignment_entity_1.AssignmentEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AssignmentService);
//# sourceMappingURL=assignment.service.js.map