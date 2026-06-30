import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Entities } from '../../constants/entity';
import { UserEntity } from './user.entity'; // Make sure to import UserEntity

@Entity(Entities.Role)
export class RoleEntity extends BaseEntity {
    
    @Column({
        type: 'varchar',
        unique: true,
        nullable: false
    })
    name: string;

    // Correctly mapping the inverse side of the relationship
    @ManyToMany(() => UserEntity , (user) => user.roles)
    users: UserEntity[];
}