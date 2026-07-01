"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcrypt"));
const user_entity_1 = require("../entities/user.entity");
const role_entity_1 = require("../entities/role.entity");
let AuthService = class AuthService {
    userRepository;
    roleRepository;
    JWT_SECRET = 'your-secure-invitation-secret-key';
    constructor(userRepository, roleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }
    async registerInvitedUser(token, plainPassword) {
        try {
            // 1. Verify and decode the JWT token
            const decoded = jwt.verify(token, this.JWT_SECRET);
            // 2. Prevent duplicates
            const existingUser = await this.userRepository.findOneBy({ email: decoded.email });
            if (existingUser) {
                throw new common_1.BadRequestException('User already registered.');
            }
            // 3. Look up all requested Role Entities from the Database at once
            const dbRoles = await this.roleRepository.findBy({
                name: (0, typeorm_2.In)(decoded.roles),
            });
            if (dbRoles.length === 0) {
                throw new common_1.NotFoundException('Assigned token roles could not be found in system.');
            }
            // 4. Find which specific entity represents their primary role selection
            const primaryRoleEntity = dbRoles.find(role => role.name === decoded.isPrimary);
            if (!primaryRoleEntity) {
                throw new common_1.BadRequestException(`Primary role specification "${decoded.isPrimary}" missing from token assignment.`);
            }
            // 5. Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
            // 6. Build the entity instance payload using TypeORM's constructor pattern
            const newUser = this.userRepository.create({
                email: decoded.email,
                firstName: decoded.firstName,
                lastName: decoded.lastName,
                password: hashedPassword,
                roles: dbRoles, // Matches ManyToMany array
                primaryRole: primaryRoleEntity, // Matches ManyToOne single column relation
            });
            // 7. Persist to DB
            await this.userRepository.save(newUser);
            return { message: 'Account successfully created' };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException || error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException('Invitation token is invalid or has expired');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.UserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.RoleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map