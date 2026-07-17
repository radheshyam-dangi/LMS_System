import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UserEntity } from "../entities/user.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RoleEntity } from "../entities/role.entity";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./strategies/jwt.strategy"; // Apne core project directory path se align karein

@Module({
    imports: [
        TypeOrmModule.forFeature([UserEntity, RoleEntity]),
        // 🔥 FIX: Passport layer authentication settings initialization modules register karein
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'secret-key',
            signOptions: { expiresIn: '1d' },
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService, 
        JwtStrategy // 👈 🔥 FIX: Injected Strategy so Guard recognizes "jwt" key labels
    ],
    exports: [
        AuthService, 
        PassportModule, 
        JwtStrategy // 👈 🔥 FIX: Exported safely so LearningPathModule context can resolve validation
    ]
})
export class AuthModule {}