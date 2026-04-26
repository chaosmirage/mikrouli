import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import type { LoginRequest } from '../../types/openapi';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
