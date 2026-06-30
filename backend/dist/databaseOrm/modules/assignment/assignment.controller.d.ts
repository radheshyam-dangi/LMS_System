import { AssignmentService } from './assignment.service';
import type { AssignmentModel } from '../../../types/models/assignment.model';
export declare class AssignmentController {
    private readonly assignmentService;
    constructor(assignmentService: AssignmentService);
    create(dto: AssignmentModel): Promise<import("../../entities/assignment.entity").AssignmentEntity>;
    findAll(): Promise<import("../../entities/assignment.entity").AssignmentEntity[]>;
    findOne(id: string): Promise<import("../../entities/assignment.entity").AssignmentEntity | null>;
    update(id: string, dto: Partial<AssignmentModel>): Promise<import("../../entities/assignment.entity").AssignmentEntity | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
