import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwitterClientModule } from './twitter-client/twitter-client.module';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from './database/database.module';
import { WalletModule } from './wallet/wallet.module';
import { XfiDexModule } from './xfi-defi/xfi-defi.module';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    WalletModule,
    DatabaseModule,
    // TwitterClientModule,
    // XfiAgentModule,
    // XfiDexModule,
    TwitterClientModule,
    // XfiAgentModule,
    XfiDexModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
