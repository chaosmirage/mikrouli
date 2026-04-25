import { IsUrl, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

const MAX_URL_LENGTH = 8192;

export class CreateLinkDto {
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, max_allowed_length: MAX_URL_LENGTH },
    { message: 'url must be a valid http(s) URL' },
  )
  url!: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}
