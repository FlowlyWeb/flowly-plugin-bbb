import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InstitutionsService } from '../../institutions/institutions.service';
import { EmailService } from '../../emails/email.service';
import { DeploymentConfig } from '../../config/deployment.config';

/**
 * QuotaGuard
 *
 * Enforces server quota limits before creating new servers.
 * Checks current usage against plan limits.
 * Sends a quota exceeded email notification in SaaS mode.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private institutionsService: InstitutionsService,
    private emailService: EmailService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const institutionId = request.user?.institutionId;

    if (!institutionId) {
      throw new ForbiddenException('Institution not found in request');
    }

    try {
      const institution = await this.institutionsService.findById(institutionId);

      if (!institution) {
        throw new ForbiddenException('Institution not found');
      }

      // Check if server quota is exceeded
      const isExceeded = (institution.quotaServersUsed || 0) >= institution.quotaServerLimit;

      if (isExceeded) {
        const planName = this.getPlanName(institution.currentPricingTier);

        // Send quota exceeded email in SaaS mode
        if (DeploymentConfig.isSaaS && request.user?.email) {
          this.emailService
            .sendQuotaExceededEmail(
              request.user.email,
              institution.name,
              'Serveurs',
              institution.quotaServerLimit,
              institution.quotaServersUsed || 0,
            )
            .catch((err) =>
              this.logger.error(`Failed to send quota exceeded email: ${err.message}`),
            );
        }

        throw new ForbiddenException(
          `Server quota limit reached for ${planName} plan (${institution.quotaServersUsed}/${institution.quotaServerLimit} servers)`,
        );
      }

      // Attach quota info to request for logging
      request.quotaInfo = {
        used: institution.quotaServersUsed,
        limit: institution.quotaServerLimit,
        tier: institution.currentPricingTier,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Error checking quota: ${err.message}`, err.stack);
      throw new ForbiddenException('Failed to check quota limits');
    }
  }

  /**
   * Maps pricing tier to French display name
   */
  private getPlanName(tier: string): string {
    const names = {
      discovery: 'Decouverte',
      starter: 'Starter',
      pro: 'Pro',
      enterprise: 'Enterprise',
    };
    return names[tier] || tier;
  }
}
