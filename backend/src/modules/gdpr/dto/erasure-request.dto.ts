import { IsString, MinLength } from 'class-validator';

export class ErasureRequestDto {
  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  confirmPhrase: string;
}
