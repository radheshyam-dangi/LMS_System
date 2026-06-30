import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoleEntity } from './role.entity';
import { Entities, Junctions } from '../../constants/entity';
import { ForeignKeys } from '../../constants/foreignKeys';

@Entity(Entities.User) 
export class UserEntity extends BaseEntity {
  
  @Column({ 
    type: 'varchar', 
    unique: true, 
    nullable: false 
  })
  email: string;

  @Column({ 
    type: 'varchar', 
    name: 'first_name', 
    nullable: true 
  })
  firstName: string; 

  @Column({ 
    type: 'varchar', 
    name: 'last_name', 
    nullable: true 
  })
  lastName: string; 

  @Column({
    type: 'varchar',
    nullable: true,
  })
  password: string;

  @ManyToMany(()=> RoleEntity,(role)=>role.users,{cascade:true})
  @JoinTable({
    name: Junctions.UserRoles,
    joinColumn: {
      name: ForeignKeys.UserRoles.UserId,
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: ForeignKeys.UserRoles.RoleId,
      referencedColumnName: 'id',
    },
  })
  roles: RoleEntity[];
}
