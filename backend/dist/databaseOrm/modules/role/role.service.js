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
exports.RoleEntityService = exports.RoleService = void 0;
const common_1 = require("@nestjs/common");
const role_service_1 = require("../../services/role.service");
Object.defineProperty(exports, "RoleEntityService", { enumerable: true, get: function () { return role_service_1.RoleEntityService; } });
let RoleService = class RoleService {
    roleEntityService;
    constructor(roleEntityService) {
        this.roleEntityService = roleEntityService;
    }
};
exports.RoleService = RoleService;
exports.RoleService = RoleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [role_service_1.RoleEntityService])
], RoleService);
//# sourceMappingURL=role.service.js.map