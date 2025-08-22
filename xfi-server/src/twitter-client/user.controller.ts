import { Controller, Body, Patch, Param, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/user.dto';
import { TwitterApi } from 'twitter-api-v2';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { UserResponseDto } from './dto/response.dto';

@Controller('users')
export class UserController {
  private twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  constructor(private readonly userService: UserService) {}

  // @Post()
  // @ApiOperation({ summary: 'Create a new User' })
  // @ApiBody({ type: CreateUserDto })
  // async createUser(@Body() createUserDto: CreateUserDto) {
  //   return this.userService.createUser(createUserDto);
  // }

  @Patch(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a  User' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'fetch a user' })
  @ApiOkResponse({ type: UserResponseDto })
  async getUser(@Param('userId') userId: string) {
    // let twitterData: any = {};
    // try {
    //   twitterData = await this.twitterClient.v1.user({ user_id: userId });
    // } catch (err) {
    //   console.error('Failed to fetch Twitter user:', err);
    //   return null;
    // }
    const user = await this.userService.getUserById(userId);
    return {
      userId: user.userId,
      walletAddress: user.walletAddress,
      username: user.userName,
    };
  }

  // @Get(':userId/evm-balance')
  // @ApiOperation({ summary: 'fetch a user' })
  // async getUserEVMBalance(
  //   @Param('userId') userId: string,
  //   @Query('chain') chain: EvmChain,
  // ): Promise<SolAsset[]> {
  //   return await this.userService.getUserEVMBalance(userId, chain);
  // }

  @Get('history/:userId')
  @ApiOperation({ summary: 'get User transaction history' })
  async getHistory(@Param('userId') userId: string) {
    return await this.userService.getTransactionHistory(userId);
  }
}
