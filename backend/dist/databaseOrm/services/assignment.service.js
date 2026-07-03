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
exports.AssignmentEntityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const base_service_1 = require("./base.service");
const assignment_entity_1 = require("../entities/assignment.entity");
let AssignmentEntityService = class AssignmentEntityService extends base_service_1.BaseService {
    repository;
    constructor(datasource) {
        // Pass the injected repository up to the generic BaseService handler
        super();
        this.repository = datasource.getRepository(assignment_entity_1.AssignmentEntity);
    }
    /**
     * Example Custom Query: Find all assignments belonging to a specific lesson
     */
    async findByLessonId(lessonId) {
        return await this.repository.find({
            where: {
                lesson: { id: lessonId }
            }
        });
    }
};
exports.AssignmentEntityService = AssignmentEntityService;
exports.AssignmentEntityService = AssignmentEntityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], AssignmentEntityService);
//# sourceMappingURL=assignment.service.js.map