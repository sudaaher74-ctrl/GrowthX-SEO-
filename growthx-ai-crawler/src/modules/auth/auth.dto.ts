import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Login and sign-up bodies, validated before they reach the service.
 *
 * Without these a missing field reached Prisma or bcrypt as `undefined` and
 * came back as a 500, and any string at all was accepted as an email.
 */
export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString({ message: 'Enter your password.' })
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(200)
  password!: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Use a password of at least 8 characters.' })
  @MaxLength(128, { message: 'Use a password of at most 128 characters.' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
