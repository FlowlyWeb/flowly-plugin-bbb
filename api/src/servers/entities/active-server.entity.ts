import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Institution } from '../../institutions/entities/institution.entity';

@Entity('active_servers')
export class ActiveServer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  serverId: string;

  @Column({ nullable: true })
  meetingId: string;

  @Column({ nullable: true })
  lastUserId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp' })
  lastHeartbeat: Date;

  @ManyToOne(() => Institution, { onDelete: 'CASCADE' })
  institution: Institution;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
