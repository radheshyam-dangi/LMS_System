import { Repository, DeleteResult } from 'typeorm';
import { BaseModel } from '../../types/models/base.model';

export abstract class BaseService<T extends BaseModel> {
  protected abstract repository: Repository<T>

  async findAll(): Promise<T[]> {
    return await this.repository.find();
  }

  async findOne(id: any): Promise<T | null> {
    return await this.repository.findOneBy({ id });
  }

  async create(data: any): Promise<T> {
    return await this.repository.save(data);
  }

  async update(id: any, data: any): Promise<T | null> {
    await this.repository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: any): Promise<DeleteResult> {
    return await this.repository.delete(id);
  }
}