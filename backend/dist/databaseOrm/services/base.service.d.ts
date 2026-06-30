import { Repository, DeleteResult } from 'typeorm';
import { BaseModel } from '../../types/models/base.model';
export declare abstract class BaseService<T extends BaseModel> {
    protected readonly repository: Repository<T>;
    constructor(repository: Repository<T>);
    findAll(): Promise<T[]>;
    findOne(id: any): Promise<T | null>;
    create(data: any): Promise<T>;
    update(id: any, data: any): Promise<T | null>;
    remove(id: any): Promise<DeleteResult>;
}
