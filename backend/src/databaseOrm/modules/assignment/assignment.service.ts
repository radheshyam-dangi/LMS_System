import { Injectable } from '@nestjs/common';
import { AssignmentService as MainAssignmentService } from '../../services/assignment.service';

@Injectable()
export class AssignmentService extends MainAssignmentService {}