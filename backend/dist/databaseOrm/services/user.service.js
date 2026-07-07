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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserEntityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const base_service_1 = require("./base.service");
const user_entity_1 = require("../entities/user.entity");
const role_entity_1 = require("../entities/role.entity");
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const SYSTEM_ROLES = ['Admin', 'Trainee', 'Trainer'];
let UserEntityService = class UserEntityService extends base_service_1.BaseService {
    repository;
    roleRepository;
    constructor(datasource) {
        super();
        this.repository = datasource.getRepository(user_entity_1.UserEntity);
        this.roleRepository = datasource.getRepository(role_entity_1.RoleEntity);
    }
    async findAll() {
        return await this.repository.find({ relations: ['roles'] });
    }
    async findOne(id) {
        return await this.repository.findOne({ where: { id }, relations: ['roles'] });
    }
    async create(data) {
        if (!data.password) {
            throw new common_1.BadRequestException('Password is required');
        }
        const existingUser = await this.findByEmail(data.email);
        if (existingUser) {
            throw new common_1.BadRequestException('User already exists with this email');
        }
        await this.ensureSystemRoles();
        // 1. Resolve the array of roles sent in the payload body
        const assignedRoles = [];
        if (data.roles && data.roles.length > 0) {
            for (const rName of data.roles) {
                const rEntity = await this.getRoleByName(rName);
                assignedRoles.push(rEntity);
            }
        }
        else {
            // Fallback if no roles are passed
            const userCount = await this.repository.count();
            const defaultRoleName = userCount === 0 ? 'Admin' : 'Trainee';
            const defaultRole = await this.getRoleByName(defaultRoleName);
            assignedRoles.push(defaultRole);
        }
        // 2. Resolve the targeted Primary Role relation
        let primaryRoleEntity;
        if (data.primaryRole) {
            primaryRoleEntity = await this.getRoleByName(data.primaryRole);
        }
        else {
            primaryRoleEntity = assignedRoles[0]; // Fallback to first role
        }
        // 3. Securely hash the secret string
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);
        // 4. Instantiate the record
        const user = this.repository.create({
            email: data.email,
            password: hashedPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            roles: assignedRoles,
            primaryRole: primaryRoleEntity, // ◄ Assigning the relation mapping
        });
        return await this.repository.save(user);
    }
    async findByEmail(email) {
        return await this.repository.findOne({ where: { email }, relations: ['roles'] });
    }
    async login(email, password) {
        const user = await this.repository.findOne({
            where: { email },
            relations: ['roles', 'primaryRole']
        });
        if (!user || !user.password) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const JWT_SECRET = 'secret-key';
        const accessToken = jwt.sign({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles?.map(r => r.name) || [],
            primaryRole: user.primaryRole?.name || 'Trainee'
        }, JWT_SECRET, { expiresIn: '1d' });
        return { user, accessToken };
    }
    async findRoleRequests() {
        const users = await this.findAll();
        return users.filter((user) => user.roles?.some((role) => role.name === 'Trainee'));
    }
    async updateUserRole(userId, roleName) {
        if (!SYSTEM_ROLES.includes(roleName)) {
            throw new common_1.BadRequestException('Role must be Admin, Trainee, or Trainer');
        }
        const user = await this.findOne(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const role = await this.getRoleByName(roleName);
        user.roles = [role];
        return await this.repository.save(user);
    }
    async ensureSystemRoles() {
        for (const name of SYSTEM_ROLES) {
            const existingRole = await this.roleRepository.findOneBy({ name });
            if (!existingRole) {
                await this.roleRepository.save(this.roleRepository.create({ name }));
            }
        }
    }
    async getRoleByName(name) {
        const role = await this.roleRepository.findOneBy({ name });
        if (!role) {
            throw new common_1.NotFoundException(`${name} role not found`);
        }
        return role;
    }
};
exports.UserEntityService = UserEntityService;
exports.UserEntityService = UserEntityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], UserEntityService);
//# sourceMappingURL=user.service.js.map