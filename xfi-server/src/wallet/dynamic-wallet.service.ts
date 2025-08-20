import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { sei } from 'viem/chains';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { Model } from 'mongoose';
import { createWalletClient, http } from 'viem';

async function loadDynamicWalletModule() {
  const { DynamicEvmWalletClient } = await import(
    '@dynamic-labs-wallet/node-evm'
  );
  const { ThresholdSignatureScheme } = await import(
    '@dynamic-labs-wallet/core'
  );
  return { DynamicEvmWalletClient, ThresholdSignatureScheme };
}

@Injectable()
export class DynamicWalletService implements OnModuleInit {
  private readonly logger = new Logger(DynamicWalletService.name);
  private DynamicEvmWalletClient: any;
  private ThresholdSignatureScheme: any;
  private client: any;

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async onModuleInit() {
    const { DynamicEvmWalletClient, ThresholdSignatureScheme } =
      await loadDynamicWalletModule();

    this.DynamicEvmWalletClient = DynamicEvmWalletClient;
    this.ThresholdSignatureScheme = ThresholdSignatureScheme;

    this.client = new this.DynamicEvmWalletClient({
      authToken: process.env.DYNAMIC_AUTH_TOKEN!,
      environmentId: process.env.DYNAMIC_ENVIRONMENT_ID!,
    });

    await this.client.authenticateApiToken(process.env.DYNAMIC_AUTH_TOKEN!);
    this.logger.log('Dynamic Wallet Client initialized & authenticated');
  }

  async authenticate() {
    await this.client.authenticateApiToken(process.env.DYNAMIC_AUTH_TOKEN!);
    return this.client;
  }

  async createWallet(): Promise<any> {
    try {
      const authenticatedClient = await this.authenticate();

      const evmWallet = await authenticatedClient.createWalletAccount({
        thresholdSignatureScheme: this.ThresholdSignatureScheme.TWO_OF_TWO,
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
