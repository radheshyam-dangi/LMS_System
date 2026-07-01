// auth/dto/complete-signup.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CompleteSignupDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Retype password must be at least 8 characters long' })
  retypePassword!: string;
}