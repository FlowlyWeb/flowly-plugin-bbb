import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function createMockContext(): ExecutionContext {
  return {
    getHandler: jest.fn().mockReturnValue(() => {}),
    getClass: jest.fn().mockReturnValue(class {}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
      getResponse: jest.fn().mockReturnValue({}),
    }),
    getType: jest.fn().mockReturnValue('http'),
    getArgs: jest.fn().mockReturnValue([]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    // Create guard and inject our mock reflector via Object.defineProperty
    // since the constructor calls super() which expects Passport setup
    guard = Object.create(JwtAuthGuard.prototype);
    (guard as unknown as { reflector: Reflector }).reflector = reflector;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when @Public() decorator is applied', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const ctx = createMockContext();

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
    });

    it('should call reflector with IS_PUBLIC_KEY', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const ctx = createMockContext();

      void guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
    });

    it('should delegate to parent when @Public is false', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      const ctx = createMockContext();

      // Mock the parent canActivate to avoid Passport dependency
      const parentCanActivate = jest.fn().mockReturnValue(true);
      jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockImplementation(parentCanActivate);

      const result = guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalled();
      expect(parentCanActivate).toHaveBeenCalledWith(ctx);
      expect(result).toBe(true);
    });

    it('should delegate to parent when @Public is undefined', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
      const ctx = createMockContext();

      const parentCanActivate = jest.fn().mockReturnValue(true);
      jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockImplementation(parentCanActivate);

      void guard.canActivate(ctx);

      expect(parentCanActivate).toHaveBeenCalledWith(ctx);
    });
  });
});
