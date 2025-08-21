import { Injectable, Logger } from '@nestjs/common';
import { sei } from 'viem/chains';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { Model } from 'mongoose';
import { createWalletClient, http } from 'viem';
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';
// import { ThresholdSignatureScheme } from '@dynamic-labs-wallet/core';

export declare enum ThresholdSignatureScheme {
  TWO_OF_TWO = 'TWO_OF_TWO',
  TWO_OF_THREE = 'TWO_OF_THREE',
  THREE_OF_FIVE = 'THREE_OF_FIVE',
}

@Injectable()
export class DynamicWalletService {
  private readonly logger = new Logger(DynamicWalletService.name);

  private client: DynamicEvmWalletClient;

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    this.initClient();
  }

  private async initClient() {
    // const { DynamicEvmWalletClient } = await import(
    //   '@dynamic-labs-wallet/node-evm'
    // );
    this.client = new DynamicEvmWalletClient({
      authToken: process.env.DYNAMIC_AUTH_TOKEN!,
      environmentId: process.env.DYNAMIC_ENVIRONMENT_ID!,
    });
  }

  async authenticate() {
    console.log(this.client);
    await this.client.authenticateApiToken(process.env.DYNAMIC_AUTH_TOKEN!);
    return this.client;
  }

  async createWallet(): Promise<any> {
    try {
      const authenticatedClient = await this.authenticate();

      const evmWallet = await authenticatedClient.createWalletAccount({
        thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
        onError: (error: Error) => {
          this.logger.error('Error creating wallet:', error.message);
          throw error;
        },
      });

      this.logger.log(`Wallet created: ${evmWallet.accountAddress}`);
      return evmWallet;
    } catch (error) {
      this.logger.error('Error in createWallet', error);
      throw error;
    }
  }

  async signTransaction(user: User, txRequest: any) {
    const authenticatedClient = await this.authenticate();

    const signedTx = await authenticatedClient.signTransaction({
      senderAddress: user.walletAddress as `0x${string}`,
      transaction: txRequest,
    });

    const walletClient = createWalletClient({
      chain: sei,
      transport: http(process.env.SEI_RPC),
      account: user.walletAddress as `0x${string}`,
    });

    const txHash = await walletClient.sendRawTransaction({
      serializedTransaction: signedTx as `0x${string}`,
    });

    return txHash;
  }
}
