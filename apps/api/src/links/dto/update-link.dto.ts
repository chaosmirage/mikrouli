import { PickType } from '@nestjs/swagger';
import { CreateLinkDto } from './create-link.dto';

// Shares CreateLinkDto's url decorators (@IsUrl + @IsPublicHttpUrl) verbatim so
// the destination-change write path is held to the exact same SSRF barrier as
// creation, rather than a second, independently maintained rule set.
export class UpdateLinkDto extends PickType(CreateLinkDto, ['url'] as const) {}
