import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';
import { BaseService } from '../../../common/services/base.service';
import { TagEntity } from '../../entities/tag.entity';

@Injectable()
export class TagEntityService extends BaseService<TagEntity> {
  protected repository: Repository<TagEntity>;
  constructor(datasource: DataSource) {
    super();
    this.repository = datasource.getRepository<TagEntity>(TagEntity);
  }
}
