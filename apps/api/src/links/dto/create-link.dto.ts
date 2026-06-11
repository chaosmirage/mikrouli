import { IsUrl, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateLinkRequest } from '../../types/openapi';
import { IsPublicHttpUrl } from './is-public-http-url.validator';

const MAX_URL_LENGTH = 8192;

export class CreateLinkDto implements Omit<CreateLinkRequest, 'expiresAt'> {
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, max_allowed_length: MAX_URL_LENGTH },
    { message: 'url must be a valid http(s) URL' },
  )
  @IsPublicHttpUrl()
  url!: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}
