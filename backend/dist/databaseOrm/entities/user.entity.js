"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const role_entity_1 = require("./role.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let UserEntity = class UserEntity extends base_entity_1.BaseEntity {
    email;
    firstName;
    lastName;
    password;
    roles;
};
exports.UserEntity = UserEntity;
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        unique: true,
        nullable: false
    }),
    __metadata("design:type", String)
], UserEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        name: 'first_name',
        nullable: true
    }),
    __metadata("design:type", String)
], UserEntity.prototype, "firstName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        name: 'last_name',
        nullable: true
    }),
    __metadata("design:type", String)
], UserEntity.prototype, "lastName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        nullable: true,
    }),
    __metadata("design:type", String)
], UserEntity.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => role_entity_1.RoleEntity, (role) => role.users, { cascade: true }),
    (0, typeorm_1.JoinTable)({
        name: entity_1.Junctions.UserRoles,
        joinColumn: {
            name: foreignKeys_1.ForeignKeys.UserRoles.UserId,
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: foreignKeys_1.ForeignKeys.UserRoles.RoleId,
            referencedColumnName: 'id',
        },
    }),
    __metadata("design:type", Array)
], UserEntity.prototype, "roles", void 0);
exports.UserEntity = UserEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.User)
], UserEntity);
//# sourceMappingURL=user.entity.js.map