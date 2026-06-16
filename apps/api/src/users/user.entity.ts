import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  // Null for OAuth-only accounts (no password credential).
  // Explicit union — never optional — so strict forces every reader to narrow null.
  @Column({ name: 'password_hash', type: 'varchar', length: 72, nullable: true })
  passwordHash: string | null;

  // Nullable per-user monthly limits; null means use the global default.
  // Explicit union — never optional — so strict forces every reader to narrow null.
  @Column({ name: 'monthly_link_limit', type: 'integer', nullable: true })
  monthlyLinkLimit: number | null;

  @Column({ name: 'monthly_key_limit', type: 'integer', nullable: true })
  monthlyKeyLimit: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
