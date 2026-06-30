import { Injectable } from '@nestjs/common';
import { TagService as MainTagService } from '../../services/tag.service';

@Injectable()
export class TagService extends MainTagService {}