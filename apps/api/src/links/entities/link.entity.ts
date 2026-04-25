import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import type { User } from '../../users/user.entity';

@Entity('links')
export class Link {
  @PrimaryColumn({ name: 'short_url', type: 'char', length: 6 })
  shortUrl!: string;

  @Column({ name: 'original_url', type: 'varchar', length: 8192 })
  originalUrl!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @ManyToOne('User')
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
