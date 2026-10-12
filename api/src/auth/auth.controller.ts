import {
  Body,
  Controller,
  ForbiddenException,
  Ip,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { safeCompare } from '../common/utils/safe-compare';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { DeploymentConfig } from '../config/deployment.config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: `
            Gets a new set of tokens using a valid refresh token.
            The new access token will contain the same user and institution information.
            
            Security measures:
            - Refresh tokens are single-use
            - Bound to the original user-agent and IP
            - Expires after 7 days
            - Previous refresh token is invalidated after use
        `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refresh_token'],
      properties: {
        refresh_token: {
          type: 'string',
          description: 'The refresh token obtained from login or previous refresh',
          example: 'abc123def456...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'New tokens generated successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT token to use for authenticated requests',
        },
        refresh_token: {
          type: 'string',
          example: 'abc123def456...',
          description: 'Token to use to get a new access token',
        },
        expires_in: {
          type: 'number',
          example: 900,
          description: 'Token expiration time in seconds (15 minutes)',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid refresh token' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async refresh(@Body('refresh_token') refreshToken: string, @Request() req, @Ip() ip: string) {
    return this.authService.refreshAccessToken(refreshToken, req.headers['user-agent'], ip);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description: `
            Authenticates a user with email and password.
            Returns JWT access token and refresh token on successful authentication.
            
            The JWT token contains:
            - User ID (sub)
            - User email
            - User roles
            - Institution ID
            
            Token expiration:
            - Access token: 15 minutes
            - Refresh token: 7 days
            
            The access token should be included in subsequent requests in the Authorization header:
            Authorization: Bearer <access_token>
        `,
  })
  @ApiBody({
    type: LoginDto,
    description: 'User credentials',
    examples: {
      'Standard Login': {
        value: {
          email: 'user@example.com',
          password: 'yourPassword123',
        },
        summary: 'Basic user login',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT access token containing user and institution information',
        },
        refresh_token: {
          type: 'string',
          example: 'abc123def456...',
          description: 'Token to obtain new access tokens',
        },
        expires_in: {
          type: 'number',
          example: 900,
          description: 'Access token expiration time in seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async login(@Body() loginDto: LoginDto, @Request() req, @Ip() ip: string) {
    return this.authService.login(loginDto, req.headers['user-agent'], ip);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('register')
  @ApiOperation({
    summary: 'User and Institution Registration',
    description: `
    Registers a new user and their institution.
    Creates the institution with default styles and the user as an administrator.
    Returns authentication tokens upon successful registration.
  `,
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Successfully registered',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT access token containing user and institution information',
        },
        refresh_token: {
          type: 'string',
          example: 'abc123def456...',
          description: 'Token to obtain new access tokens',
        },
        expires_in: {
          type: 'number',
          example: 900,
          description: 'Access token expiration time in seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid registration data',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or domain already exists',
  })
  async register(@Body() registerDto: RegisterDto, @Request() req, @Ip() ip: string) {
    if (DeploymentConfig.isOnPremise) {
      throw new ForbiddenException('Registration is disabled in on-premise mode');
    }
    return this.authService.register(registerDto, req.headers['user-agent'], ip);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('setup-admin')
  @ApiOperation({
    summary: 'One-time admin account creation (on-premise only)',
    description: `
      Creates the initial admin account during on-premise installation.
      Only available in on-premise mode when no users exist yet.
      Requires X-API-Key header matching INTERNAL_API_KEY.
    `,
  })
  @ApiBody({ type: SetupAdminDto })
  @ApiResponse({ status: 201, description: 'Admin account created successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 403, description: 'Not available in this deployment mode' })
  @ApiResponse({ status: 409, description: 'Admin account already exists' })
  async setupAdmin(@Body() setupAdminDto: SetupAdminDto, @Request() req, @Ip() ip: string) {
    const apiKey = req.headers['x-api-key'];
    if (!safeCompare(apiKey, this.configService.get<string>('INTERNAL_API_KEY'))) {
      throw new UnauthorizedException();
    }
    if (!DeploymentConfig.isOnPremise) {
      throw new ForbiddenException('This endpoint is only available in on-premise mode');
    }
    return this.authService.setupAdmin(setupAdminDto, req.headers['user-agent'], ip);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Change user password',
    description: `
      Changes the password of the authenticated user.
      Requires current password for verification and the new password.
      After successful password change, all refresh tokens for this user will be revoked
      except for the current session.
    `,
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password successfully changed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password changed successfully' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Current password is incorrect' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Request() req) {
    // JwtStrategy exposes the user id as `userId` (there is no `id` field)
    const success = await this.authService.changePassword(req.user.userId, changePasswordDto);

    return {
      success,
      message: 'Password changed successfully',
    };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: `
      Initiates the password reset process by sending an email with a reset link.
      For security reasons, the endpoint always returns success even if the email doesn't exist.
    `,
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent (if email exists)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'If your email exists in our system, you will receive a password reset link',
        },
      },
    },
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto);

    return {
      success: true,
      message: 'If your email exists in our system, you will receive a password reset link',
    };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password with token',
    description: `
      Sets a new password using the token received in the reset email.
      The token is valid for 1 hour and can only be used once.
    `,
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password successfully reset',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password has been reset successfully' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid or expired token' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const success = await this.authService.resetPassword(resetPasswordDto);

    return {
      success,
      message: 'Password has been reset successfully',
    };
  }
}
