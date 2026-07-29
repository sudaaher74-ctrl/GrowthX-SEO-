import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true; // No specific roles required
    }
    const { user } = context.switchToHttp().getRequest();
    // Assuming user payload has roles or we fetch from DB. 
    // In a real app we would query the user's role in the organization they are accessing.
    // This is a placeholder for the multi-tenant role check.
    if (!user || !user.roles) {
      return false;
    }
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
