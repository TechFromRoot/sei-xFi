import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ParseCommandService } from './parse-command';
import { ApiOperation } from '@nestjs/swagger';
import { CommandDto } from './dto/command.dto';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';

@Controller('bot-command')
export class TwitterClientController {
  constructor(private readonly handleDefiService: ParseCommandService) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send Command to the bot' })
  async prompt(@Body() commandDto: CommandDto, @Req() req: any) {
    const userId = req.user.sub;
    if (userId !== commandDto.userId) {
      return { error: 'Unauthorized user' };
    }
    return this.handleDefiService.handleTweetCommand(
      commandDto.prompt,
      commandDto.userId,
      undefined,
      'terminal',
    );
  }
}
