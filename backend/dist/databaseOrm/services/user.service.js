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
        return await this.userRepository.findOne({ where: { id }, relations: ['roles'] });
    }
    async create(data) {
        if (!data.email || !data.password) {
            throw new common_1.BadRequestException('Email and password are required');
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
        const user = await this.findByEmail(email);
        if (!user || user.password !== password) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        return user;
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