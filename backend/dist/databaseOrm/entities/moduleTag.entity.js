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
exports.ModuleTagEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const module_entity_1 = require("./module.entity");
const tag_entity_1 = require("./tag.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let ModuleTagEntity = class ModuleTagEntity extends base_entity_1.BaseEntity {
    module;
    tag;
};
exports.ModuleTagEntity = ModuleTagEntity;
__decorate([
    (0, typeorm_1.ManyToOne)(() => module_entity_1.ModuleEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.ModuleTag.ModuleId }),
    __metadata("design:type", module_entity_1.ModuleEntity)
], ModuleTagEntity.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tag_entity_1.TagEntity, (tag) => tag.moduleTags, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.ModuleTag.TagId }),
    __metadata("design:type", tag_entity_1.TagEntity)
], ModuleTagEntity.prototype, "tag", void 0);
exports.ModuleTagEntity = ModuleTagEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.ModuleTag)
], ModuleTagEntity);
//# sourceMappingURL=moduleTag.entity.js.map