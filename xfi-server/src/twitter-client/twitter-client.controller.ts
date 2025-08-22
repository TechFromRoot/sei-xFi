import { Body, Controller, Post } from '@nestjs/common';
import { ParseCommandService } from './parse-command';
import { ApiOperation } from '@nestjs/swagger';
import { CommandDto } from './dto/command.dto';

@Controller('bot-command')
export class TwitterClientController {
  constructor(private readonly handleDefiService: ParseCommandService) {}
  @Post()
  @ApiOperation({ summary: 'Send Command to the bot' })
  quote(@Body() commandDto: CommandDto) {
    console.log(commandDto);
    return this.handleDefiService.handleTweetCommand(
      commandDto.prompt,
      commandDto.userId,
    );
  }
}
