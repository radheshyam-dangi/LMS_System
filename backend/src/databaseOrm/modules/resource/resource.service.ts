import { Injectable } from '@nestjs/common';
import { ResourceEntityService } from '../../services/resource.service';

@Injectable()
export class ResourceService {
    constructor(private resourceEntityService:ResourceEntityService){}
}
export {ResourceEntityService}