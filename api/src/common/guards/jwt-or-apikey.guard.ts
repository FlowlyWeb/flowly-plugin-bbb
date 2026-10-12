import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { safeCompare } from '../utils/safe-compare';

/**
 * Guard that accepts either JWT token or API Key
 * Useful for endpoints that need to be accessible from both:
 * - Frontend (with JWT)
 * - Inter-service communication (with API Key)
 */
@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    // If API Key is provided, validate it
    if (apiKey) {
      const validApiKey = this.configService.get<string>('INTERNAL_API_KEY');

      if (safeCompare(apiKey, validApiKey)) {
        // API Key is valid: flag the request as an internal call for tenant checks
        request.isInternalApiCall = true;
        return true;
      } else {
        throw new UnauthorizedException('Invalid API Key');
      }
    }

    // No API Key, fall back to JWT authentication
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      throw new UnauthorizedException('Invalid or missing authentication');
    }
  }
}
