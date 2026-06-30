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
exports.DocumentEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const entity_1 = require("../../constants/entity");
let DocumentEntity = class DocumentEntity extends base_entity_1.BaseEntity {
    identifier;
    mimeType;
    documentName;
    originalDocumentName;
    documentUrl;
    extension;
    encoding;
    sizeBytes;
    uploadCount;
};
exports.DocumentEntity = DocumentEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true, nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "identifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'mimeType', nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'documentName', nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "documentName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'originalDocumentName', nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "originalDocumentName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'documentUrl', nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "documentUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "extension", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], DocumentEntity.prototype, "encoding", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', name: 'sizeBytes', default: 0 }),
    __metadata("design:type", Number)
], DocumentEntity.prototype, "sizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'uploadCount', default: 1 }),
    __metadata("design:type", Number)
], DocumentEntity.prototype, "uploadCount", void 0);
exports.DocumentEntity = DocumentEntity = __decorate([
    (0, typeorm_1.Entity)(entity_1.Entities.Document)
], DocumentEntity);
//# sourceMappingURL=document.entity.js.map