import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  assertInstitutionAccess,
  assertPrivilegedCaller,
  InstitutionAccessGuard,
  isPrivilegedCaller,
} from './institution-access.guard';
import { safeCompare } from '../utils/safe-compare';

describe('Institution access (tenant isolation)', () => {
  const userOfA = { user: { userId: 'user-a', institutionId: 'inst-a' } };
  const superAdmin = { user: { userId: 'admin', userRoles: ['super_admin'] } };
  const internalCall = { isInternalApiCall: true };

  describe('assertInstitutionAccess', () => {
    it('allows a user on its own institution', () => {
      expect(() => assertInstitutionAccess(userOfA, 'inst-a')).not.toThrow();
    });

    it('rejects a user on another institution', () => {
      expect(() => assertInstitutionAccess(userOfA, 'inst-b')).toThrow(ForbiddenException);
    });

    it('rejects when the caller has no institution', () => {
      expect(() => assertInstitutionAccess({ user: { userId: 'u' } }, 'inst-a')).toThrow(
        ForbiddenException,
      );
      expect(() => assertInstitutionAccess(undefined, 'inst-a')).toThrow(ForbiddenException);
    });

    it('rejects when the target institution id is missing', () => {
      expect(() => assertInstitutionAccess(userOfA, undefined)).toThrow(ForbiddenException);
    });

    it('allows super admins and internal API-key calls on any institution', () => {
      expect(() => assertInstitutionAccess(superAdmin, 'inst-b')).not.toThrow();
      expect(() => assertInstitutionAccess(internalCall, 'inst-b')).not.toThrow();
    });
  });

  describe('assertPrivilegedCaller', () => {
    it('rejects normal users', () => {
      expect(isPrivilegedCaller(userOfA)).toBe(false);
      expect(() => assertPrivilegedCaller(userOfA)).toThrow(ForbiddenException);
    });

    it('does not trust roles other than super_admin', () => {
      expect(isPrivilegedCaller({ user: { userRoles: ['admin'] } })).toBe(false);
    });

    it('allows super admins and internal calls', () => {
      expect(() => assertPrivilegedCaller(superAdmin)).not.toThrow();
      expect(() => assertPrivilegedCaller(internalCall)).not.toThrow();
    });
  });

  describe('InstitutionAccessGuard', () => {
    const guard = new InstitutionAccessGuard();
    const contextFor = (request: object) =>
      ({
        switchToHttp: () => ({ getRequest: () => request }),
      }) as unknown as ExecutionContext;

    it('allows access to the caller institution from the route param', () => {
      expect(
        guard.canActivate(contextFor({ ...userOfA, params: { institutionId: 'inst-a' } })),
      ).toBe(true);
    });

    it('rejects access to another institution from the route param', () => {
      expect(() =>
        guard.canActivate(contextFor({ ...userOfA, params: { institutionId: 'inst-b' } })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('safeCompare', () => {
    it('matches identical secrets only', () => {
      expect(safeCompare('secret-key', 'secret-key')).toBe(true);
      expect(safeCompare('secret-kez', 'secret-key')).toBe(false);
      expect(safeCompare('short', 'secret-key')).toBe(false);
    });

    it('fails closed when the expected secret is not configured', () => {
      expect(safeCompare('', '')).toBe(false);
      expect(safeCompare('anything', undefined)).toBe(false);
      expect(safeCompare(undefined, 'secret-key')).toBe(false);
    });
  });
});
