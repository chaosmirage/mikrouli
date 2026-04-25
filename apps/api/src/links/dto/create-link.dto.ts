import { IsUrl, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLinkDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  originalUrl!: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}
