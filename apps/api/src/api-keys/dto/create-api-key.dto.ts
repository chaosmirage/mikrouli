import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { CreateApiKeyRequest } from '../../types/openapi';

const MAX_LABEL_LENGTH = 64;

export class CreateApiKeyDto implements CreateApiKeyRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_LENGTH)
  label!: string;
}
