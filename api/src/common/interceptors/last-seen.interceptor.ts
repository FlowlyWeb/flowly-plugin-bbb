import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class LastSeenInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(async () => {
        try {
          if (request.user) {
            let userId: string | null = null;

            if (request.user.userId) {
              userId = request.user.userId;
            } else if (request.user.id) {
              const user = await this.userRepository.findOne({
                where: {
                  institution: { id: request.user.id },
                  isActive: true,
                },
              });

              if (user) {
                userId = user.id;
              }
            }

            if (userId) {
              await this.userRepository.update({ id: userId }, { lastSeen: new Date() });
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(
            'Failed to update lastSeen:',
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );
  }
}
