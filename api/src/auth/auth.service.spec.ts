import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/tokens.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { InstitutionsService } from '../institutions/institutions.service';
import { EmailService } from '../emails/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, GeoRegion } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

jest.mock('bcrypt');
jest.mock('crypto');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedCrypto = crypto as jest.Mocked<typeof crypto>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let passwordResetTokenRepository: jest.Mocked<Repository<PasswordResetToken>>;
  let jwtService: jest.Mocked<JwtService>;
  let institutionsService: jest.Mocked<InstitutionsService>;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    institution: {
      id: 'inst-uuid-1',
      domain: 'example.com',
      name: 'Test Institution',
    } as User['institution'],
  };

  const mockTokenResponse = {
    access_token: 'jwt-access-token',
    refresh_token: 'random-hex-refresh-token',
    expires_in: 900,
  };

  const userAgent = 'Mozilla/5.0 Test';
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-access-token'),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: InstitutionsService,
          useValue: {
            findByOrigin: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn(),
            sendPasswordChangedEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
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

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    passwordResetTokenRepository = module.get(getRepositoryToken(PasswordResetToken));
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    institutionsService = module.get(InstitutionsService) as jest.Mocked<InstitutionsService>;
    emailService = module.get(EmailService) as jest.Mocked<EmailService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    // Default bcrypt mock behavior
    (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
    (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');

    // Default crypto mock behavior
    const mockBuffer = {
      toString: jest.fn().mockReturnValue('random-hex-refresh-token'),
    };
    (mockedCrypto.randomBytes as jest.Mock).mockReturnValue(mockBuffer);

    const mockHashUpdate = {
      update: jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('sha256-hashed-token'),
      }),
    };
    (mockedCrypto.createHash as jest.Mock).mockReturnValue(mockHashUpdate);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // validateUser
  // ---------------------------------------------------------------------------
  describe('validateUser', () => {
    const loginDto: LoginDto = { email: 'Test@Example.com', password: 'password123' };

    it('should return user when credentials are valid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(loginDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', isActive: true },
        relations: ['institution'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should normalize email to lowercase before lookup', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await service.validateUser({ email: 'USER@EXAMPLE.COM', password: 'pass12345' });

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'user@example.com' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------
  describe('login', () => {
    const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };

    it('should return tokens on successful login', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto, userAgent, ip);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 900);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          type: 'access',
        }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });

    it('should include institution info in JWT payload', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await service.login(loginDto, userAgent, ip);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: 'inst-uuid-1',
          domain: 'example.com',
        }),
        expect.any(Object),
      );
    });

    it('should handle user with no institution gracefully', async () => {
      const userNoInstitution = { ...mockUser, institution: undefined };
      userRepository.findOne.mockResolvedValue(userNoInstitution as unknown as User);

      await service.login(loginDto, userAgent, ip);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: null,
          domain: null,
        }),
        expect.any(Object),
      );
    });

    it('should save a hashed refresh token to the database', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await service.login(loginDto, userAgent, ip);

      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'hashed-value',
          userAgent,
        }),
      );
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto, userAgent, ip)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------------------------------------------------------------------------
  // register
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

    const mockInstitution = {
      id: 'inst-uuid-2',
      domain: 'newcorp.com',
      name: 'New Corp',
    };

    beforeEach(() => {
      userRepository.findOne.mockResolvedValue(null);
      institutionsService.findByOrigin.mockResolvedValue(null);
      institutionsService.create.mockResolvedValue(mockInstitution as never);
      userRepository.create.mockReturnValue({
        ...registerDto,
        id: 'user-uuid-2',
        passwordHash: 'hashed-value',
        institution: mockInstitution,
        isActive: true,
      } as unknown as User);
      userRepository.save.mockResolvedValue({} as User);
    });

    it('should register a new user and return tokens', async () => {
      const result = await service.register(registerDto, userAgent, ip);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 900);
    });

    it('should normalize email to lowercase', async () => {
      const dtoUpperEmail = { ...registerDto, email: 'NEW@EXAMPLE.COM' };

      await service.register(dtoUpperEmail, userAgent, ip);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
    });

    it('should create the institution with provided details', async () => {
      await service.register(registerDto, userAgent, ip);

      expect(institutionsService.create).toHaveBeenCalledWith({
        name: 'New Corp',
        domain: 'newcorp.com',
        address: '123 Main St',
        vatNumber: undefined,
        geoRegion: GeoRegion.FRANCE,
      });
    });

    it('should hash the password before saving', async () => {
      await service.register(registerDto, userAgent, ip);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await expect(service.register(registerDto, userAgent, ip)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto, userAgent, ip)).rejects.toThrow(
        'Email already exists',
      );
    });

    it('should throw ConflictException when domain already exists', async () => {
      userRepository.findOne.mockResolvedValue(null);
      institutionsService.findByOrigin.mockResolvedValue(mockInstitution as never);

      await expect(service.register(registerDto, userAgent, ip)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto, userAgent, ip)).rejects.toThrow(
        'Domain already exists',
      );
    });

    it('should send welcome email after registration', async () => {
      await service.register(registerDto, userAgent, ip);

      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        'new@example.com',
        'Jane Doe',
        'New Corp',
      );
    });

    it('should not throw if welcome email fails', async () => {
      emailService.sendWelcomeEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.register(registerDto, userAgent, ip)).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // changePassword
  // ---------------------------------------------------------------------------
  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword123',
    };
    const userId = 'user-uuid-1';

    it('should change password and return true', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.changePassword(userId, changePasswordDto);

      expect(result).toBe(true);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw UnauthorizedException when current password is incorrect', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(
        'Current password is incorrect',
      );
    });

    it('should send password changed email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.changePassword(userId, changePasswordDto);

      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'John Doe',
      );
    });

    it('should not throw if password changed email fails', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      emailService.sendPasswordChangedEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.changePassword(userId, changePasswordDto)).resolves.toBe(true);
    });

    it('should look up the authenticated user by id (not by institution)', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.changePassword(userId, changePasswordDto);

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: userId, isActive: true } }),
      );
    });

    it('should reject when no user id is provided', async () => {
      await expect(
        service.changePassword(undefined as unknown as string, changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should revoke all refresh tokens of the user after password change', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.changePassword(userId, changePasswordDto);

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({
        user: { id: userId },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // forgotPassword
  // ---------------------------------------------------------------------------
  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = { email: 'test@example.com' };

    it('should return true even if user does not exist (security)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should delete old reset tokens and create a new one', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      configService.get.mockReturnValue('https://app.example.com');

      await service.forgotPassword(forgotPasswordDto);

      expect(passwordResetTokenRepository.delete).toHaveBeenCalledWith({
        user: { id: 'user-uuid-1' },
      });
      expect(passwordResetTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'sha256-hashed-token',
          user: mockUser,
          used: false,
        }),
      );
    });

    it('should send password reset email with correct URL', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      configService.get.mockReturnValue('https://app.example.com');

      await service.forgotPassword(forgotPasswordDto);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'random-hex-refresh-token',
        'https://app.example.com/auth',
      );
    });

    it('should clean up token if email sending fails', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      configService.get.mockReturnValue('https://app.example.com');
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP error'));

      await service.forgotPassword(forgotPasswordDto);

      // Token should be deleted on email failure (second call to delete)
      expect(passwordResetTokenRepository.delete).toHaveBeenCalledTimes(2);
    });

    it('should normalize email to lowercase for lookup', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await service.forgotPassword({ email: 'TEST@EXAMPLE.COM' });

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', isActive: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // resetPassword
  // ---------------------------------------------------------------------------
  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      token: 'raw-reset-token',
      password: 'newSecurePass123',
    };

    const mockResetToken: Partial<PasswordResetToken> = {
      id: 'reset-token-uuid',
      token: 'sha256-hashed-token',
      used: false,
      expiresAt: new Date(Date.now() + 3600000),
      user: mockUser as User,
    };

    it('should reset password and return true', async () => {
      passwordResetTokenRepository.findOne.mockResolvedValue(mockResetToken as PasswordResetToken);

      const result = await service.resetPassword(resetPasswordDto);

      expect(result).toBe(true);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newSecurePass123', 10);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should mark the reset token as used', async () => {
      passwordResetTokenRepository.findOne.mockResolvedValue(mockResetToken as PasswordResetToken);

      await service.resetPassword(resetPasswordDto);

      expect(passwordResetTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ used: true }),
      );
    });

    it('should throw UnauthorizedException for invalid or expired token', async () => {
      passwordResetTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should revoke all refresh tokens of the user', async () => {
      // The reset token only loads the `user` relation (no institution)
      const resetTokenWithoutInstitution = {
        ...mockResetToken,
        user: { ...mockUser, institution: undefined },
      };
      passwordResetTokenRepository.findOne.mockResolvedValue(
        resetTokenWithoutInstitution as unknown as PasswordResetToken,
      );

      await service.resetPassword(resetPasswordDto);

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({
        user: { id: 'user-uuid-1' },
      });
    });

    it('should send password changed email after reset', async () => {
      passwordResetTokenRepository.findOne.mockResolvedValue(mockResetToken as PasswordResetToken);

      await service.resetPassword(resetPasswordDto);

      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'John Doe',
      );
    });

    it('should not throw if password changed email fails', async () => {
      passwordResetTokenRepository.findOne.mockResolvedValue(mockResetToken as PasswordResetToken);
      emailService.sendPasswordChangedEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.resetPassword(resetPasswordDto)).resolves.toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // refreshAccessToken
  // ---------------------------------------------------------------------------
  describe('refreshAccessToken', () => {
    const refreshToken = 'valid-refresh-token';

    const mockSavedToken: Partial<RefreshToken> = {
      id: 'token-uuid',
      token: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000),
      userAgent,
      ipHash: 'sha256-hashed-token',
      institution: { id: 'inst-uuid-1' } as RefreshToken['institution'],
      user: { id: 'user-uuid-1' } as User,
    };

    beforeEach(() => {
      refreshTokenRepository.delete.mockResolvedValue(undefined as never);
      refreshTokenRepository.find.mockResolvedValue([mockSavedToken as RefreshToken]);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      userRepository.findOne.mockResolvedValue(mockUser as User);
      refreshTokenRepository.remove.mockResolvedValue(undefined as never);
    });

    it('should return new tokens for a valid refresh token', async () => {
      const result = await service.refreshAccessToken(refreshToken, userAgent, ip);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 900);
    });

    it('should clean up expired tokens before validating', async () => {
      await service.refreshAccessToken(refreshToken, userAgent, ip);

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Object),
        }),
      );
    });

    it('should remove the old refresh token after use (single-use)', async () => {
      await service.refreshAccessToken(refreshToken, userAgent, ip);

      expect(refreshTokenRepository.remove).toHaveBeenCalledWith(mockSavedToken);
    });

    it('should throw UnauthorizedException when no matching token is found', async () => {
      refreshTokenRepository.find.mockResolvedValue([]);

      await expect(service.refreshAccessToken(refreshToken, userAgent, ip)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when bcrypt compare fails for all tokens', async () => {
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshAccessToken(refreshToken, userAgent, ip)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not found or inactive', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshAccessToken(refreshToken, userAgent, ip)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should issue tokens for the owner of the refresh token', async () => {
      const otherUser = {
        ...mockUser,
        id: 'user-uuid-2',
        email: 'second@example.com',
      } as User;
      refreshTokenRepository.find.mockResolvedValue([
        { ...mockSavedToken, user: { id: 'user-uuid-2' } } as RefreshToken,
      ]);
      userRepository.findOne.mockResolvedValue(otherUser);

      await service.refreshAccessToken(refreshToken, userAgent, ip);

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-uuid-2', isActive: true } }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-uuid-2', email: 'second@example.com' }),
        expect.any(Object),
      );
    });

    it('should bind the new refresh token to the user', async () => {
      await service.refreshAccessToken(refreshToken, userAgent, ip);

      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: 'user-uuid-1' } }),
      );
    });

    it('should reject and consume legacy refresh tokens not bound to a user', async () => {
      const legacyToken = { ...mockSavedToken, user: null } as RefreshToken;
      refreshTokenRepository.find.mockResolvedValue([legacyToken]);

      await expect(service.refreshAccessToken(refreshToken, userAgent, ip)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(refreshTokenRepository.remove).toHaveBeenCalledWith(legacyToken);
    });
  });

  // ---------------------------------------------------------------------------
  // setupAdmin
  // ---------------------------------------------------------------------------
  describe('setupAdmin', () => {
    const registerDto: RegisterDto = {
      email: 'admin@example.com',
      password: 'adminPass123',
      firstName: 'Admin',
      lastName: 'User',
      institutionName: 'Admin Corp',
      institutionDomain: 'admincorp.com',
      address: '456 Admin St',
      geoRegion: GeoRegion.EU,
    };

    it('should call register when no users exist', async () => {
      userRepository.count.mockResolvedValue(0);
      // Mock the register chain
      userRepository.findOne.mockResolvedValue(null);
      institutionsService.findByOrigin.mockResolvedValue(null);
      institutionsService.create.mockResolvedValue({
        id: 'inst-uuid-admin',
        domain: 'admincorp.com',
        name: 'Admin Corp',
      } as never);
      userRepository.create.mockReturnValue({
        id: 'user-admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        institution: { id: 'inst-uuid-admin', domain: 'admincorp.com' },
        isActive: true,
      } as unknown as User);
      userRepository.save.mockResolvedValue({} as User);

      const result = await service.setupAdmin(registerDto, userAgent, ip);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw ConflictException when users already exist', async () => {
      userRepository.count.mockResolvedValue(1);

      await expect(service.setupAdmin(registerDto, userAgent, ip)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.setupAdmin(registerDto, userAgent, ip)).rejects.toThrow(
        'Admin already created',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createTokens
  // ---------------------------------------------------------------------------
  describe('createTokens', () => {
    const payload = {
      sub: 'user-uuid-1',
      email: 'test@example.com',
      institutionId: 'inst-uuid-1',
    };

    it('should return access_token, refresh_token, and expires_in', async () => {
      const result = await service.createTokens(payload, userAgent, ip);

      expect(result).toEqual({
        access_token: 'jwt-access-token',
        refresh_token: 'random-hex-refresh-token',
        expires_in: 900,
      });
    });

    it('should sign JWT with access type and 15m expiry', async () => {
      await service.createTokens(payload, userAgent, ip);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ ...payload, type: 'access' }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });

    it('should hash the refresh token before storing', async () => {
      await service.createTokens(payload, userAgent, ip);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('random-hex-refresh-token', 10);
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'hashed-value' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // revokeAllTokens
  // ---------------------------------------------------------------------------
  describe('revokeAllTokens', () => {
    it('should delete all refresh tokens for the institution', async () => {
      await service.revokeAllTokens('inst-uuid-1');

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({
        institution: { id: 'inst-uuid-1' },
      });
    });
  });
});
