import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

export const SUPER_ADMIN_ROLE = 'super_admin';

/**
 * Shape of the request fields used for tenant isolation checks.
 * - `user` is populated by JwtStrategy (normal user: userId/institutionId,
 *   super admin: userRoles containing 'super_admin').
 * - `isInternalApiCall` is set by JwtOrApiKeyGuard when a valid X-API-Key was provided.
 */
export interface InstitutionAccessRequest {
  user?: {
    userId?: string;
    institutionId?: string;
    userRoles?: string[];
  };
  isInternalApiCall?: boolean;
}

/**
 * Returns true for inter-service calls (valid API key) and super admin JWTs.
 */
export function isPrivilegedCaller(request: InstitutionAccessRequest | undefined): boolean {
  if (request?.isInternalApiCall === true) {
    return true;
  }

  const roles = request?.user?.userRoles;
  return Array.isArray(roles) && roles.includes(SUPER_ADMIN_ROLE);
}

/**
 * Throws ForbiddenException unless the caller is an internal service or a super admin.
 */
export function assertPrivilegedCaller(request: InstitutionAccessRequest | undefined): void {
  if (!isPrivilegedCaller(request)) {
    throw new ForbiddenException('Insufficient permissions');
  }
}

/**
 * Throws ForbiddenException unless the caller may act on the given institution:
 * internal API-key calls, super admins, or users belonging to that institution.
 */
export function assertInstitutionAccess(
  request: InstitutionAccessRequest | undefined,
  institutionId: string | undefined,
): void {
  if (isPrivilegedCaller(request)) {
    return;
  }

  const callerInstitutionId = request?.user?.institutionId;
  if (!institutionId || !callerInstitutionId || callerInstitutionId !== institutionId) {
    throw new ForbiddenException('You do not have access to this institution');
  }
}

/**
 * Guard enforcing tenant isolation on routes with an `:institutionId` path parameter.
 * Must run after an authentication guard (JwtAuthGuard / JwtOrApiKeyGuard).
 *
 * @example
 * @Controller('institutions/:institutionId/workspaces')
 * @UseGuards(JwtAuthGuard, InstitutionAccessGuard)
 */
@Injectable()
export class InstitutionAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    assertInstitutionAccess(request, request.params?.institutionId);
    return true;
  }
}
