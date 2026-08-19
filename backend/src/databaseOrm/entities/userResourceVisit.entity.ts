import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ResourceEntity } from './resource.entity';
import { Entities } from '../../constants/entity';

@Entity(Entities.UserResourceVisit)
@Unique(['user', 'resource'])
export class UserResourceVisitEntity extends BaseEntity {
  @Column({
    type: 'timestamp',
    name: 'visited_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  visitedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ResourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: ResourceEntity;
}
