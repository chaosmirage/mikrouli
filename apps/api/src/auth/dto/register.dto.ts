import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_COMPLEXITY_PATTERN = /(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])/;
const PASSWORD_COMPLEXITY_MESSAGE = 'password must contain upper, lower, and digit';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password: string;
}
