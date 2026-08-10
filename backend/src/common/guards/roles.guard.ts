import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: User session missing.');
    }

    const userRoles: string[] = [];

    const extractRole = (roleItem: any) => {
      if (typeof roleItem === 'string') {
        userRoles.push(roleItem.toLowerCase());
      } else if (roleItem && typeof roleItem === 'object') {
        if (roleItem.name) userRoles.push(String(roleItem.name).toLowerCase());
        if (roleItem.roleName) userRoles.push(String(roleItem.roleName).toLowerCase());
        if (roleItem.title) userRoles.push(String(roleItem.title).toLowerCase());
      }
    };

    if (user.role) extractRole(user.role);
    if (user.primaryRole) extractRole(user.primaryRole);
    if (user.activeRole) extractRole(user.activeRole);
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => extractRole(r));
    }

    const hasRole = requiredRoles.some((requiredRole) =>
      userRoles.includes(requiredRole.toLowerCase())
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Your token role (${userRoles.join(', ') || 'None'}) does not have permission to perform this action.`
      );
    }

    return true;
  }
}