import { Injectable, Logger } from '@nestjs/common';
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';
import { ThresholdSignatureScheme } from '@dynamic-labs-wallet/core';
import { sei } from 'viem/chains';
// import { parseEther } from 'viem/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { Model } from 'mongoose';
import { createWalletClient, http } from 'viem';

@Injectable()
export class DynamicWalletService {
  private readonly logger = new Logger(DynamicWalletService.name);
  private client: DynamicEvmWalletClient;

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    this.client = new DynamicEvmWalletClient({
      authToken: process.env.DYNAMIC_AUTH_TOKEN!,
      environmentId: process.env.DYNAMIC_ENVIRONMENT_ID!,
    });
  }

  async authenticate() {
    await this.client.authenticateApiToken(process.env.DYNAMIC_AUTH_TOKEN!);
    return this.client;
  }

  async createWallet(): Promise<any> {
    try {
      const authenticatedClient = await this.authenticate();

      // Create new wallet using Dynamic's server-side infrastructure
      const evmWallet = await authenticatedClient.createWalletAccount({
        thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
        onError: (error: Error) => {
          console.error('Error creating wallet:', error);
          throw error;
        },
      });

      //   const evmWallet = await this.client.createWalletAccount({
      //     thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      //     password,
      //     backUpToClientShareService: true,
      //     onError: (error: Error) => {
      //       this.logger.error('Wallet creation error:', error.message);
      //     },
      //   });

      this.logger.log(`Wallet created: ${evmWallet.accountAddress}`);

      return evmWallet;
    } catch (error) {
      console.error('Error in getWallet:', error);
      throw error;
    }
  }

  async signTransaction(user: User, txRequest: any) {
    const authenticatedClient = await this.authenticate();

    // const publicClient = this.client.createViemPublicClient({
    //   chain,
    //   rpcUrl: process.env.SEI_RPC,
    // });

    // const nounce = await publicClient.getTransactionCount({
    //   address: user.walletAddress as `0x${string}`,
    // });

    // const txRequest = await publicClient?.prepareTransactionRequest({
    //   chain,

    //   account: address as `0x${string}`,
    //   to: '0x0000000000000000000000000000000000000000',
    //   value: parseEther('0.0001'),
    // });

    // Sign the transaction with Dynamic's server-side infrastructure
    const signedTx = await authenticatedClient.signTransaction({
      senderAddress: user.walletAddress as `0x${string}`,
      transaction: txRequest,
    });

    // Send the signed transaction
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
