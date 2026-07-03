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
exports.DocumentEntityService = exports.DocumentService = void 0;
const common_1 = require("@nestjs/common");
const document_service_1 = require("../../services/document.service");
Object.defineProperty(exports, "DocumentEntityService", { enumerable: true, get: function () { return document_service_1.DocumentEntityService; } });
let DocumentService = class DocumentService {
    DocumentEntityService;
    constructor(DocumentEntityService) {
        this.DocumentEntityService = DocumentEntityService;
    }
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [document_service_1.DocumentEntityService])
], DocumentService);
//# sourceMappingURL=document.service.js.map