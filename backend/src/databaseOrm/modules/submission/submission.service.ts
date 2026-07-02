import { Injectable } from '@nestjs/common';
import { SubmissionEntityService } from '../../services/submission.service';

@Injectable()
export class SubmissionService  {
    constructor(private submissionEntityService:SubmissionEntityService){}
}
export {SubmissionEntityService};