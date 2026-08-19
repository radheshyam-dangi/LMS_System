import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const data = request?.cookies?.['accessToken'];
          if (!data) {
            return ExtractJwt.fromAuthHeaderAsBearerToken()(request);
          }
          return data;
        },
      ]),
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
