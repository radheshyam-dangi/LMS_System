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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const base_service_1 = require("./base.service");
const user_entity_1 = require("../entities/user.entity"); // Path to where your actual entity class sits
const role_entity_1 = require("../entities/role.entity");
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const SYSTEM_ROLES = ['Admin', 'Trainee', 'Trainer'];
let UserService = class UserService extends base_service_1.BaseService {
    userRepository;
    roleRepository;
    constructor(userRepository, roleRepository) {
        // Pass the user repository up to the generic BaseService
        super(userRepository);
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }
    async findAll() {
        return await this.userRepository.find({ relations: ['roles'] });
    }
    async findOne(id) {
        console.log("User find succcessfully");
        return await this.userRepository.findOne({ where: { id }, relations: ['roles'] });
    }
    async create(data) {
        if (!data.password) {
            throw new common_1.BadRequestException('password are required');
        }
        const existingUser = await this.findByEmail(data.email);
        if (existingUser) {
            throw new common_1.BadRequestException('User already exists with this email');
        }
        await this.ensureSystemRoles();
        const userCount = await this.userRepository.count();
        const roleName = userCount === 0 ? 'Admin' : 'Trainee';
        const role = await this.getRoleByName(roleName);
        const user = this.userRepository.create({
            email: data.email,
            password: data.password,
            firstName: data.firstName,
            lastName: data.lastName,
            roles: [role],
        });
        return await this.userRepository.save(user);
    }
    // You can add specific custom queries for users here
    async findByEmail(email) {
        return await this.userRepository.findOne({ where: { email }, relations: ['roles'] });
    }
    async login(email, password) {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ['roles', 'primaryRole'] // Ensure primaryRole is fetched!
        });
        if (!user || !user.password) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        // 1. Verify the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        // 2. Generate an access token containing the essential payload details
        const JWT_SECRET = 'your-secure-invitation-secret-key'; // Keep this safe in env variables
        const accessToken = jwt.sign({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles?.map(r => r.name) || [],
            primaryRole: user.primaryRole?.name || 'Trainee'
        }, JWT_SECRET, { expiresIn: '1d' });
        // Remove password from returned data for security
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
        await this.ensureSystemRoles();
        const user = await this.findOne(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const role = await this.getRoleByName(roleName);
        user.roles = [role];
        return await this.userRepository.save(user);
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
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.UserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.RoleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], UserService);
//# sourceMappingURL=user.service.js.map