import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// Stores the link between a mikrouli account and an external OAuth provider identity.
// One row per (provider, user) pair; the unique constraints on the table enforce
// the "one GitHub identity per account" policy at the database level.
@Entity('provider_accounts')
export class ProviderAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identifies the OAuth provider; typed as a string-literal union so new providers
  // extend the union without altering the column type.
  @Column({ type: 'varchar', length: 32 })
  provider: 'github';

  // The provider-assigned user identifier (stable, not the user's email or username).
  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  providerUserId: string;

  // FK to the owning mikrouli account. ON DELETE CASCADE mirrors api_key.entity.ts:
  // deleting a user removes all its provider links automatically.
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
