import { Injectable } from '@nestjs/common';
import { SubmissionService as MainSubmissionService } from '../../services/submission.service';

@Injectable()
export class SubmissionService extends MainSubmissionService {}