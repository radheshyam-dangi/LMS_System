import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      // Frontend se aane wale Bearer token ko extract karega
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,

      secretOrKey: process.env.JWT_SECRET || 'secret-key', 
    });
  }

  async validate(payload: any) {
    // Yeh payload request (req.user) me save ho jayega jise @GetUser() decorator read karega
    return { 
      id: payload.id || payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}