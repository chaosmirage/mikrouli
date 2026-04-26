import { IsEmail, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import type { RegisterRequest } from '../../types/openapi';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 255;
const PASSWORD_COMPLEXITY_PATTERN = /(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])/;
const PASSWORD_COMPLEXITY_MESSAGE = 'password must contain upper, lower, and digit';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string;
}
