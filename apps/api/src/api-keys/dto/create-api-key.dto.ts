import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_LABEL_LENGTH = 64;

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_LENGTH)
  label: string;
}
