import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userRole = user?.role || user?.primaryRole;
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Access denied: You do not have permission to perform this action.');
    }

    return true;
  }
}