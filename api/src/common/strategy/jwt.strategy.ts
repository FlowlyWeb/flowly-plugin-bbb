import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InstitutionsService } from '../../institutions/institutions.service';
import * as process from 'node:process';

/** JWT token payload structure */
interface JwtPayload {
  sub: string;
  email: string;
  roles?: string[];
  institutionId?: string;
  domain?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private institutionsService: InstitutionsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || '',
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.roles && payload.roles.includes('super_admin')) {
      return {
        id: null,
        email: payload.email,
        userId: payload.sub,
        userRoles: payload.roles,
      };
    }

    // Verify that the institution exists
    const institution = payload.institutionId
      ? await this.institutionsService.findById(payload.institutionId)
      : null;

    if (!institution) {
      throw new UnauthorizedException();
    }

    // Return user data with institutionId, not the institution itself
    return {
      userId: payload.sub,
      email: payload.email,
      institutionId: payload.institutionId,
      domain: payload.domain,
    };
  }
}
