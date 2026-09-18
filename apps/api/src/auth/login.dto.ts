import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  mfaCode?: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}

export class MfaCodeDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class MfaSetupDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
