import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, GeoRegion } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { DeploymentConfig } from '../config/deployment.config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  const mockTokenResponse = {
    access_token: 'jwt-access-token',
    refresh_token: 'random-refresh-token',
    expires_in: 900,
  };

  const mockRequest = {
    headers: { 'user-agent': 'Mozilla/5.0 Test', 'x-api-key': undefined as string | undefined },
    // Shape returned by JwtStrategy for a normal user
    user: { userId: 'user-uuid-1', institutionId: 'inst-uuid-1' },
  };

  const mockIp = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            register: jest.fn(),
            setupAdmin: jest.fn(),
            changePassword: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            refreshAccessToken: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // POST /auth/login
  // ---------------------------------------------------------------------------
  describe('login', () => {
    const loginDto: LoginDto = { email: 'user@example.com', password: 'password123' };

    it('should return tokens on successful login', async () => {
      authService.login.mockResolvedValue(mockTokenResponse);

      const result = await controller.login(loginDto, mockRequest, mockIp);

      expect(result).toEqual(mockTokenResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto, 'Mozilla/5.0 Test', mockIp);
    });

    it('should pass through UnauthorizedException from service', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto, mockRequest, mockIp)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/register
  // ---------------------------------------------------------------------------
  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Doe',
      institutionName: 'New Corp',
      institutionDomain: 'newcorp.com',
      address: '123 Main St',
      geoRegion: GeoRegion.FRANCE,
    };

    // Store original value to restore after tests
    let originalIsOnPremise: boolean;

    beforeEach(() => {
      originalIsOnPremise = DeploymentConfig.isOnPremise;
    });

    afterEach(() => {
      // Restore using Object.defineProperty since it's a getter
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => originalIsOnPremise,
        configurable: true,
      });
    });

    it('should return tokens on successful registration in SaaS mode', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => false,
        configurable: true,
      });
      authService.register.mockResolvedValue(mockTokenResponse);

      const result = await controller.register(registerDto, mockRequest, mockIp);

      expect(result).toEqual(mockTokenResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto, 'Mozilla/5.0 Test', mockIp);
    });

    it('should throw ForbiddenException in on-premise mode', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => true,
        configurable: true,
      });

      await expect(controller.register(registerDto, mockRequest, mockIp)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.register(registerDto, mockRequest, mockIp)).rejects.toThrow(
        'Registration is disabled in on-premise mode',
      );
    });

    it('should pass through ConflictException when email exists', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => false,
        configurable: true,
      });
      authService.register.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(controller.register(registerDto, mockRequest, mockIp)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/setup-admin
  // ---------------------------------------------------------------------------
  describe('setupAdmin', () => {
    const setupAdminDto: SetupAdminDto = {
      email: 'admin@example.com',
      password: 'adminPass123',
      firstName: 'Admin',
      lastName: 'User',
      institutionName: 'Admin Corp',
      institutionDomain: 'admincorp.com',
      address: '456 Admin St',
      geoRegion: GeoRegion.EU,
    };

    let originalIsOnPremise: boolean;

    beforeEach(() => {
      originalIsOnPremise = DeploymentConfig.isOnPremise;
    });

    afterEach(() => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => originalIsOnPremise,
        configurable: true,
      });
    });

    it('should create admin in on-premise mode with valid API key', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => true,
        configurable: true,
      });
      configService.get.mockReturnValue('valid-api-key');
      authService.setupAdmin.mockResolvedValue(mockTokenResponse);

      const req = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-api-key': 'valid-api-key' },
      };

      const result = await controller.setupAdmin(setupAdminDto, req, mockIp);

      expect(result).toEqual(mockTokenResponse);
      expect(authService.setupAdmin).toHaveBeenCalledWith(
        setupAdminDto,
        'Mozilla/5.0 Test',
        mockIp,
      );
    });

    it('should throw UnauthorizedException when API key is missing', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => true,
        configurable: true,
      });
      configService.get.mockReturnValue('valid-api-key');

      const req = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-api-key': undefined },
      };

      await expect(controller.setupAdmin(setupAdminDto, req, mockIp)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when API key is invalid', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => true,
        configurable: true,
      });
      configService.get.mockReturnValue('valid-api-key');

      const req = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-api-key': 'wrong-key' },
      };

      await expect(controller.setupAdmin(setupAdminDto, req, mockIp)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException in SaaS mode', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => false,
        configurable: true,
      });
      configService.get.mockReturnValue('valid-api-key');

      const req = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-api-key': 'valid-api-key' },
      };

      await expect(controller.setupAdmin(setupAdminDto, req, mockIp)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should pass through ConflictException when admin already exists', async () => {
      Object.defineProperty(DeploymentConfig, 'isOnPremise', {
        get: () => true,
        configurable: true,
      });
      configService.get.mockReturnValue('valid-api-key');
      authService.setupAdmin.mockRejectedValue(new ConflictException('Admin already created'));

      const req = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-api-key': 'valid-api-key' },
      };

      await expect(controller.setupAdmin(setupAdminDto, req, mockIp)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/change-password
  // ---------------------------------------------------------------------------
  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword123',
    };

    it('should return success response on password change', async () => {
      authService.changePassword.mockResolvedValue(true);

      const result = await controller.changePassword(changePasswordDto, mockRequest);

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(authService.changePassword).toHaveBeenCalledWith('user-uuid-1', changePasswordDto);
    });

    it('should use the user ID (userId) from JWT user context', async () => {
      authService.changePassword.mockResolvedValue(true);
      const reqWithOtherUser = {
        ...mockRequest,
        user: { userId: 'user-uuid-999', institutionId: 'inst-uuid-1' },
      };

      await controller.changePassword(changePasswordDto, reqWithOtherUser);

      expect(authService.changePassword).toHaveBeenCalledWith('user-uuid-999', changePasswordDto);
    });

    it('should pass through UnauthorizedException from service', async () => {
      authService.changePassword.mockRejectedValue(
        new UnauthorizedException('Current password is incorrect'),
      );

      await expect(controller.changePassword(changePasswordDto, mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/forgot-password
  // ---------------------------------------------------------------------------
  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = { email: 'user@example.com' };

    it('should return generic success message regardless of email existence', async () => {
      authService.forgotPassword.mockResolvedValue(true);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(result).toEqual({
        success: true,
        message: 'If your email exists in our system, you will receive a password reset link',
      });
    });

    it('should call authService.forgotPassword with the DTO', async () => {
      authService.forgotPassword.mockResolvedValue(true);

      await controller.forgotPassword(forgotPasswordDto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/reset-password
  // ---------------------------------------------------------------------------
  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      token: 'valid-reset-token',
      password: 'newSecurePass123',
    };

    it('should return success response on password reset', async () => {
      authService.resetPassword.mockResolvedValue(true);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toEqual({
        success: true,
        message: 'Password has been reset successfully',
      });
    });

    it('should pass through UnauthorizedException for invalid token', async () => {
      authService.resetPassword.mockRejectedValue(
        new UnauthorizedException('Invalid or expired token'),
      );

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/refresh
  // ---------------------------------------------------------------------------
  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      authService.refreshAccessToken.mockResolvedValue(mockTokenResponse);

      const result = await controller.refresh('valid-refresh-token', mockRequest, mockIp);

      expect(result).toEqual(mockTokenResponse);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'valid-refresh-token',
        'Mozilla/5.0 Test',
        mockIp,
      );
    });

    it('should pass through UnauthorizedException for invalid refresh token', async () => {
      authService.refreshAccessToken.mockRejectedValue(new UnauthorizedException());

      await expect(controller.refresh('invalid-token', mockRequest, mockIp)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
