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
exports.DocumentAssociationEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const document_entity_1 = require("./document.entity");
const entity_1 = require("../../constants/entity");
const foreignKeys_1 = require("../../constants/foreignKeys");
let DocumentAssociationEntity = class DocumentAssociationEntity extends base_entity_1.BaseEntity {
    associationType;
    associationId;
    description;
    refCount;
    document;
};
exports.DocumentAssociationEntity = DocumentAssociationEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'associationType', nullable: false }),
    __metadata("design:type", String)
], DocumentAssociationEntity.prototype, "associationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: foreignKeys_1.ForeignKeys.DocumentAssociation.AssociationId, nullable: false }),
    __metadata("design:type", String)
], DocumentAssociationEntity.prototype, "associationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DocumentAssociationEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'refCount', default: 1 }),
    __metadata("design:type", Number)
], DocumentAssociationEntity.prototype, "refCount", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => document_entity_1.DocumentEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: foreignKeys_1.ForeignKeys.DocumentAssociation.DocumentId }),
    __metadata("design:type", document_entity_1.DocumentEntity)
], DocumentAssociationEntity.prototype, "document", void 0);
exports.DocumentAssociationEntity = DocumentAssociationEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.DocumentAssociation)
], DocumentAssociationEntity);
//# sourceMappingURL=documentAssociation.entity.js.map