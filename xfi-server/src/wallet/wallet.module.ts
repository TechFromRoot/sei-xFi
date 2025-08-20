import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import { DynamicWalletService } from './dynamic-wallet.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [WalletService, DynamicWalletService],
  exports: [WalletService, DynamicWalletService],
})
export class WalletModule {}
