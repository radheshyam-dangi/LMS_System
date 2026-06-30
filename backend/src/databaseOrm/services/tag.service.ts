import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { TagEntity } from '../entities/tag.entity';

@Injectable()
export class TagService extends BaseService<TagEntity> {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
  ) {
    super(tagRepository);
  }
}