import { Injectable } from '@nestjs/common';
import { AssignmentEntityService, AssignmentEntityService as MainAssignmentService } from '../../services/assignment.service';

@Injectable()
export class AssignmentService {
    constructor(private AssignmentEntityService : AssignmentEntityService){}
}
export {AssignmentEntityService}