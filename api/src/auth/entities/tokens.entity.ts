import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Institution } from '../../institutions/entities/institution.entity';
import { User } from '../../user/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Institution, { onDelete: 'CASCADE' })
  institution: Institution;

  /** Owner of the refresh token. Tokens without a user (legacy) are rejected on refresh. */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  user: User | null;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  ipHash: string;
}
