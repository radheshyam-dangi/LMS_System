import { Injectable } from '@nestjs/common';
import { TagEntityService} from '../../services/tag.service';

@Injectable()
export class TagService 
{
    constructor(private tagEntityService : TagEntityService){}

}
export {TagEntityService};