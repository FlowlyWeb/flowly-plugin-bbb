import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from './entities/tokens.entity';
import { LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InstitutionsService } from '../institutions/institutions.service';
import { EmailService } from '../emails/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
    private institutionsService: InstitutionsService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async validateUser(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email.toLowerCase(), isActive: true },
      relations: ['institution'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(loginDto: LoginDto, userAgent: string, ip: string) {
    const user = await this.validateUser(loginDto);

    const payload = {
      sub: user.id,
      user: {
        firstname: user.firstName,
        lastname: user.lastName,
      },
      email: user.email,
      institutionId: user.institution?.id || null,
      domain: user.institution?.domain || null,
    };

    return this.createTokens(payload, userAgent, ip);
  }

  async register(registerDto: RegisterDto, userAgent: string, ip: string) {
    const normalizedEmail = registerDto.email.toLowerCase();

    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const existingInstitution = await this.institutionsService.findByOrigin(
      registerDto.institutionDomain,
    );

    if (existingInstitution) {
      throw new ConflictException('Domain already exists');
    }

    const institution = await this.institutionsService.create({
      name: registerDto.institutionName,
      domain: registerDto.institutionDomain,
      address: registerDto.address,
      vatNumber: registerDto.vatNumber,
      geoRegion: registerDto.geoRegion,
    });

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      institution: institution,
      isActive: true,
    });

    await this.userRepository.save(user);

    try {
      await this.emailService.sendWelcomeEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        institution.name,
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to send welcome email:', error);
    }

    // Générer les tokens
    const payload = {
      sub: user.id,
      email: user.email,
      user: {
        firstname: user.firstName,
        lastname: user.lastName,
      },
      institutionId: institution.id,
      domain: institution.domain,
    };

    return this.createTokens(payload, userAgent, ip);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<boolean> {
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isActive: true,
      },
      relations: ['institution'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.userRepository.save(user);

    try {
      await this.emailService.sendPasswordChangedEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to send password changed email:', error);
    }

    await this.revokeAllTokensExceptCurrent(user.id);

    return true;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: {
        email: forgotPasswordDto.email.toLowerCase(),
        isActive: true,
      },
    });

    if (!user) {
      return true;
    }

    await this.passwordResetTokenRepository.delete({
      user: { id: user.id },
    });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() + 1);

    await this.passwordResetTokenRepository.save({
      token: hashedToken,
      expiresAt: expireDate,
      user: user,
      used: false,
    });

    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const resetUrl = `${frontendUrl}/auth`;

      await this.emailService.sendPasswordResetEmail(user.email, resetToken, resetUrl);
    } catch {
      await this.passwordResetTokenRepository.delete({
        token: hashedToken,
      });
    }

    return true;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<boolean> {
    // Vérifier le token
    const hashedToken = crypto.createHash('sha256').update(resetPasswordDto.token).digest('hex');

    const passwordResetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        token: hashedToken,
        expiresAt: MoreThan(new Date()),
        used: false,
      },
      relations: ['user'],
    });

    if (!passwordResetToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = passwordResetToken.user;

    // Hasher le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(resetPasswordDto.password, 10);

    // Mettre à jour le mot de passe
    user.passwordHash = newPasswordHash;
    await this.userRepository.save(user);

    // Marquer le token comme utilisé
    passwordResetToken.used = true;
    await this.passwordResetTokenRepository.save(passwordResetToken);

    // Send password changed confirmation email
    try {
      await this.emailService.sendPasswordChangedEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to send password changed email:', error);
    }

    // Revoke all refresh tokens of this user to force re-login on every device
    await this.revokeUserTokens(user.id);

    return true;
  }

  // Revoke all refresh tokens of a user, except the current one if provided
  async revokeAllTokensExceptCurrent(userId: string, currentRefreshToken?: string) {
    if (currentRefreshToken) {
      // Si un token est fourni, on garde celui-là et on supprime les autres
      const tokens = await this.refreshTokenRepository.find({
        where: { user: { id: userId } },
      });

      // Filtrer pour ne garder que le token courant
      for (const token of tokens) {
        // Vérifier si ce n'est pas le token courant
        const isCurrentToken = await bcrypt.compare(currentRefreshToken, token.token);
        if (!isCurrentToken) {
          await this.refreshTokenRepository.remove(token);
        }
      }
    } else {
      // Si aucun token n'est fourni, on supprime tous les tokens
      await this.revokeUserTokens(userId);
    }
  }

  private hashIp(ip: string): string {
    return crypto
      .createHash('sha256')
      .update(ip + process.env.IP_HASH_SALT) // Hash with salt for RGPD compliance
      .digest('hex');
  }

  async createTokens(payload: Record<string, unknown>, userAgent: string, ip: string) {
    const accessToken = this.jwtService.sign(
      {
        ...payload,
        type: 'access',
      },
      {
        expiresIn: '15m',
        encoding: 'utf8',
      },
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.save({
      token: await bcrypt.hash(refreshToken, 10),
      expiresAt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      institution: payload.institutionId ? ({ id: payload.institutionId } as any) : undefined,
      // Bind the refresh token to its owner so refresh issues tokens for this exact user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: payload.sub ? ({ id: payload.sub } as any) : undefined,
      userAgent,
      ipHash: this.hashIp(ip),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
    };
  }

  async refreshAccessToken(refreshToken: string, userAgent: string, ip: string) {
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    // Find all non-expired tokens matching userAgent and IP
    const savedTokens = await this.refreshTokenRepository.find({
      where: {
        userAgent,
        ipHash: this.hashIp(ip),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['institution', 'user'],
    });

    // Find the matching token by comparing the provided refresh token with stored hashes
    let savedToken: RefreshToken | null = null;
    for (const token of savedTokens) {
      if (await bcrypt.compare(refreshToken, token.token)) {
        savedToken = token;
        break;
      }
    }

    if (!savedToken) {
      throw new UnauthorizedException();
    }

    // Refresh tokens are single-use: invalidate before issuing new tokens
    await this.refreshTokenRepository.remove(savedToken);

    // Legacy tokens not bound to a user cannot be refreshed: force a new login
    if (!savedToken.user?.id) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Issue tokens for the owner of the refresh token only, and only if still active
    const user = await this.userRepository.findOne({
      where: {
        id: savedToken.user.id,
        isActive: true,
      },
      relations: ['institution'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      user: {
        firstname: user.firstName,
        lastname: user.lastName,
      },
      institutionId: user.institution?.id || null,
      domain: user.institution?.domain || null,
    };

    return this.createTokens(payload, userAgent, ip);
  }

  async revokeAllTokens(institutionId: string) {
    await this.refreshTokenRepository.delete({
      institution: { id: institutionId },
    });
  }

  async revokeUserTokens(userId: string) {
    await this.refreshTokenRepository.delete({
      user: { id: userId },
    });
  }

  async setupAdmin(registerDto: RegisterDto, userAgent: string, ip: string) {
    const userCount = await this.userRepository.count();
    if (userCount > 0) {
      throw new ConflictException('Admin already created');
    }
    return this.register(registerDto, userAgent, ip);
  }
}
