import { BaseModel } from './base.model';

export interface DocumentAssociationModel extends BaseModel {
  associationType: string;
  description?: string;
  refCount: number;
}