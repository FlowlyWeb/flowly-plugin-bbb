import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/tokens.entity';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../common/strategy/jwt.strategy';
import { AuthController } from './auth.controller';
import { InstitutionsModule } from '../institutions/institutions.module';
import { UserModule } from '../user/user.module';
import { ConfigService } from '@nestjs/config';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailModule } from '../emails/email.module';
import { JwtOrApiKeyGuard } from '../common/guards/jwt-or-apikey.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: (config: ConfigService): any => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: `${config.get<number>('jwt.expirationTime')}s`,
        },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken, PasswordResetToken]),
    UserModule,
    InstitutionsModule,
    EmailModule,
  ],
  providers: [AuthService, JwtStrategy, JwtOrApiKeyGuard, RateLimitGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtOrApiKeyGuard],
})
export class AuthModule {}
