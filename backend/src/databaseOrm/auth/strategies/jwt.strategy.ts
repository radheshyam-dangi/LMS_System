import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret-key', 
    });
  }

  async validate(payload: any) {
    return { 
      id: payload.id || payload.sub, 
      email: payload.email, 
      role: payload.role || payload.primaryRole || payload.activeRole,
      primaryRole: payload.primaryRole || payload.role,
      activeRole: payload.activeRole || payload.role,
      roles: payload.roles || (payload.role ? [payload.role] : []),
    };
  }
}