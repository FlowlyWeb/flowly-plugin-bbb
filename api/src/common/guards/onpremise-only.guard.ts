import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that restricts access to on-premise deployments only.
 *
 * Use this guard on endpoints that should only be available
 * in on-premise mode (e.g., update management, system settings).
 *
 * @example
 * ```typescript
 * @Controller('admin/updates')
 * @UseGuards(OnPremiseOnlyGuard)
 * export class UpdatesController { ... }
 * ```
 */
@Injectable()
export class OnPremiseOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE', 'saas');

    if (deploymentMode !== 'onpremise') {
      throw new ForbiddenException('This endpoint is only available in on-premise mode');
    }

    return true;
  }
}
