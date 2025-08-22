import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    type: String,
    required: true,
    example: '134666482662882',
    description: 'user twitter id',
  })
  userId: string;

  @ApiProperty({
    type: String,
    required: true,
    example: 'xfi_user',
    description: 'user twitter username',
  })
  userName: string;
}

export class UpdateUserDto {
  @ApiProperty({
    type: String,
    required: false,
    example: 'xfi_user',
    description: 'user twitter username',
  })
  userName?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    example: 'true',
    description: 'activate a users wallet',
  })
  isActive?: boolean;
}
