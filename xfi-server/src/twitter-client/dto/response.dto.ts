import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'twitter user ID ',
    example: '17288278227811872',
  })
  userId: string;

  @ApiProperty({
    description: 'Twitter Username of the user',
    example: 'johndoe',
  })
  userName: string;

  @ApiProperty({
    description: 'Twitter Display name of the user',
    example: 'John Doe',
  })
  displayName: string;

  @ApiProperty({
    description: 'Profile image URL',
    example: 'https://example.com/avatar.jpg',
  })
  profileImage: string;

  @ApiProperty({
    description: 'Wallet address of the user',
    example: '0x123abc456def789...',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Whether the user is active',
    default: true,
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Supported blockchain chains',
    enum: ['sei', 'ethereum'],
    isArray: true,
    example: ['sei', 'ethereum'],
  })
  chains: string[];
}

export class FilteredTokenResponseDto {
  @ApiProperty({ example: 'MILLI' })
  name: string;

  @ApiProperty({ example: 'MILLI' })
  symbol: string;

  @ApiProperty({ example: 6 })
  decimals: number;

  @ApiProperty({ example: 1724.733497 })
  amount: number;

  @ApiProperty({ example: 1724733497 })
  raw_amount: number;

  @ApiProperty({ example: 0.000014859545291039 })
  token_usd_price: number;

  @ApiProperty({ example: 35.1 })
  amount_usd_value: number;
}
