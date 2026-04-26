import { IsNotEmpty, IsString } from 'class-validator';
import type { RefreshRequest } from '../../types/openapi';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
