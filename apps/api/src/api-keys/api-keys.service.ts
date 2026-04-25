import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ApiKey } from './api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const BCRYPT_ROUNDS = 10;
const SECRET_BYTES = 32;
const KEY_PREFIX_LENGTH = 8;
const KEY_NAMESPACE = 'mk_';

export type ApiKeySummary = Pick<
  ApiKey,
  'id' | 'label' | 'keyPrefix' | 'createdAt' | 'lastUsedAt' | 'revokedAt'
>;

export interface CreatedApiKey {
  id: string;
  label: string;
  key: string;
  keyPrefix: string;
  createdAt: Date;
}

function extractSummary(key: ApiKey): ApiKeySummary {
  const { id, label, keyPrefix, createdAt, lastUsedAt, revokedAt } = key;
  return { id, label, keyPrefix, createdAt, lastUsedAt, revokedAt };
}

function buildCreatedResult(saved: ApiKey, key: string, prefix: string): CreatedApiKey {
  return { id: saved.id, label: saved.label, key, keyPrefix: prefix, createdAt: saved.createdAt };
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly repo: Repository<ApiKey>,
  ) {}

  private generateSecret(): { plaintext: string; prefix: string } {
    const random = crypto.randomBytes(SECRET_BYTES).toString('base64url');
    const plaintext = `${KEY_NAMESPACE}${random}`;
    const prefix = random.slice(0, KEY_PREFIX_LENGTH);
    return { plaintext, prefix };
  }

  private parsePrefix(plaintext: string): string {
    return plaintext.slice(KEY_NAMESPACE.length, KEY_NAMESPACE.length + KEY_PREFIX_LENGTH);
  }

  async createForUser(userId: string, dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    const { plaintext, prefix } = this.generateSecret();
    const keyHash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
    const entity = this.repo.create({ userId, label: dto.label, keyHash, keyPrefix: prefix });
    const saved = await this.repo.save(entity);
    return buildCreatedResult(saved, plaintext, prefix);
  }

  async listForUser(userId: string): Promise<ApiKeySummary[]> {
    const keys = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return keys.map(extractSummary);
  }

  async revoke(userId: string, id: string): Promise<void> {
    const result = await this.repo.update({ id, userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException(`API key ${id} not found`);
  }

  async validate(plaintext: string): Promise<{ userId: string } | null> {
    const prefix = this.parsePrefix(plaintext);
    const key = await this.repo.findOne({ where: { keyPrefix: prefix, revokedAt: IsNull() }, relations: ['user'] });
    if (!key) return null;
    const match = await bcrypt.compare(plaintext, key.keyHash);
    if (!match) return null;
    this.markUsed(key.id);
    return { userId: key.userId };
  }

  private markUsed(id: string): void {
    void this.repo.update(id, { lastUsedAt: new Date() }).catch((err: unknown) => this.logMarkUsedFailure(id, err));
  }

  private logMarkUsedFailure(id: string, err: unknown): void {
    this.logger.warn(`Failed to update last_used_at for key ${id}: ${String(err)}`);
  }
}
