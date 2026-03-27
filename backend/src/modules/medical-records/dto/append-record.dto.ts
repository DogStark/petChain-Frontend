import { IsString, IsNotEmpty } from 'class-validator';

/** Appends an immutable observation to an existing record's notes */
export class AppendRecordDto {
  @IsString() @IsNotEmpty()
  observation: string;
}
