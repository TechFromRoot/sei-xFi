import { Injectable, Logger } from '@nestjs/common';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
// import { ethers } from 'ethers';
import {
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  http,
  parseEther,
  parseUnits,
} from 'viem';
import { User } from 'src/database/schemas/user.schema';
// import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';
import { DynamicWalletService } from 'src/wallet/dynamic-wallet.service';
import { sei } from 'viem/chains';
// import { openai } from '@ai-sdk/openai';
// import { generateText } from 'ai';
// import { http } from 'viem';
// import { createWalletClient } from 'viem';
// import { privateKeyToAccount } from 'viem/accounts';
// import { sei } from 'viem/chains';
// import { Symphony } from 'symphony-sdk/viem';
const {
  Symphony,
  getRouteDetails,
  swap,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('symphony-sdk/viem');

@Injectable()
export class XfiDefiSeiService {
  private readonly logger = new Logger(XfiDefiSeiService.name);
  private symphony = new Symphony();
  // private provider = new ethers.JsonRpcProvider(process.env.SEI_RPC);
  // private client: DynamicEvmWalletClient;
  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    private readonly dynamicWalletService: DynamicWalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async sendSEI(
    user: User,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const authenticatedClient =
        await this.dynamicWalletService.authenticate();

      const publicClient = authenticatedClient.createViemPublicClient({
        chain: sei,
        rpcUrl: process.env.SEI_RPC,
      });

      const balance = await publicClient.getBalance({
        address: user.walletAddress as `0x${string}`,
      });

      this.logger.log(balance);

      if (Number(formatEther(balance)) < Number(amount)) {
        return 'Insufficient balance.';
      }

      const nonce = await publicClient.getTransactionCount({
        address: user.walletAddress as `0x${string}`,
      });

      const txRequest = await publicClient.prepareTransactionRequest({
        chain: sei,
        to: reciever as `0x${string}`,
        value: parseEther(amount),
        kzg: undefined,
        nonce,
      });

      const txn = await this.dynamicWalletService.signTransaction(
        user,
        txRequest,
      );

      if (txn) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: txn,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://seitrace.com/tx/${txn}`;
      }
      return;
    } catch (error) {
      console.log(error);
      this.logger.log(error);
      return `error sending token`;
    }
  }

  async sendERC20(
    user: User,
    token: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
    decimals?: number,
  ) {
    try {
      const authenticatedClient =
        await this.dynamicWalletService.authenticate();

      const publicClient = authenticatedClient.createViemPublicClient({
        chain: sei,
        rpcUrl: process.env.SEI_RPC,
      });

      const balance = await publicClient.readContract({
        abi: erc20Abi,
        address: token as `0x${string}`,
        functionName: 'balanceOf',
        args: [user.walletAddress as `0x${string}`],
      });

      this.logger.log('Token balance:', balance.toString());

      if (Number(balance) < Number(amount)) {
        return 'Insufficient balance.';
      }

      const nonce = await publicClient.getTransactionCount({
        address: user.walletAddress as `0x${string}`,
      });

      const txRequest = await publicClient.prepareTransactionRequest({
        chain: sei,
        to: token as `0x${string}`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [
            reciever as `0x${string}`,
            parseUnits(amount, decimals ? decimals : 18),
          ],
        }),
        kzg: undefined,
        nonce,
      });

      const txn = await this.dynamicWalletService.signTransaction(
        user,
        txRequest,
      );

      if (txn) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: txn,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://seitrace.com/tx/${txn}`;
      }
      return;
    } catch (error) {
      console.log(error);
      this.logger.log(error);
      return `error sending token`;
    }
  }

  async getSwapRoute(tokenIn: string, tokenOut: string, amount: string) {
    const route = await this.symphony.getRoute(tokenIn, tokenOut, amount);
    const details = await getRouteDetails(route.route);
    return { route, routeDetails: details };
  }

  async getSupportedTokens() {
    const tokenLists = await this.symphony.getTokenList();
    return tokenLists;
  }

  async isTokenSupported(address: string) {
    const tokenListed = await this.symphony.isTokenListed(
      address.toLowerCase().trim(),
    );
    return tokenListed;
  }

  // async getTokenBalance(
  //   tokenAddress: string,
  //   decimal: number,
  //   walletAddress: string,
  // ) {
  //   if (tokenAddress === '0x0') {
  //     if (this.provider) {
  //       const seiNativebalance = await this.provider.getBalance(walletAddress);
  //       const formattedBalance = ethers.formatEther(seiNativebalance);
  //       return { formattedBalance };
  //     }
  //     return;
  //   }
  //   const tokenContract: Contract =
  //     await this.getERC20TokenContract(tokenAddress);

  //   const tokenBalance = await tokenContract.balanceOf(walletAddress);

  //   const formattedBalance = formatUnits(tokenBalance, decimal);
  //   return { formattedBalance };
  // }

  // async checkTokenApproval(
  //   tokenIn: string,
  //   amount: string,
  //   privateKey: string,
  // ) {
  //   const signer = new ethers.Wallet(privateKey, this.provider);

  //   const isApproved = await checkApproval({
  //     variable: tokenIn,
  //     signer,
  //     amount,
  //     options: { isRaw: false },
  //   });

  //   return isApproved;
  // }

  // async giveTokenApproval(tokenIn: string, amount: string, privateKey: string) {
  //   const signer = new ethers.Wallet(privateKey, this.provider);

  //   const approve = await giveApproval({
  //     variable: tokenIn,
  //     signer,
  //     amount,
  //     options: { isRaw: false },
  //   });

  //   // return { txHash: approve.hash };
  //   return `https://seitrace.com/tx/${approve.hash}`;
  // }

  async swapToken(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    user: User,
    slippage?: string,
  ) {
    console.log('Swapping ....');

    const nativeAddress = this.symphony.getConfig().nativeAddress;
    const walletClient = createWalletClient({
      chain: sei,
      transport: http(process.env.SEI_RPC),
      account: user.walletAddress as `0x${string}`,
    });
    let includesNative = false;

    const route = await this.symphony.getRoute(tokenIn, tokenOut, amount);

    if (tokenIn === nativeAddress || tokenOut === nativeAddress) {
      includesNative = true;
      console.log('Swapping ...., isNative');
    }
    const transaction = await swap({
      route: route.route,
      includesNative,
      walletClient,
      options: {
        skipApproval: true,
        skipCheckApproval: true,
      },
      slippage: {
        slippageAmount: slippage || '1',
        isRaw: true,
        isBps: false,
      },
    });

    console.log('Transaction Hash:', transaction);

    return `https://seitrace.com/tx/${transaction.swapReceipt.hash}`;
  }

  async buyToken(
    tokenOut: string,
    amount: string,
    user: User,
    originalCommand: string,
  ) {
    console.log('Swapping ....');

    const nativeAddress = this.symphony.getConfig().nativeAddress;
    const tokenIn = nativeAddress;
    const walletClient = createWalletClient({
      chain: sei,
      transport: http(process.env.SEI_RPC),
      account: user.walletAddress as `0x${string}`,
    });
    let includesNative = false;
    console.log(tokenIn, tokenOut, amount);
    const route = await this.symphony.getRoute(tokenIn, tokenOut, amount);

    console.log(route);

    if (tokenIn === nativeAddress || tokenOut === nativeAddress) {
      includesNative = true;
      console.log('Swapping ...., isNative');
    }
    const transaction = await swap({
      route: route.route,
      includesNative,
      walletClient,
      options: {
        skipApproval: true,
        skipCheckApproval: true,
      },
      slippage: {
        slippageAmount: '1',
        isRaw: true,
        isBps: false,
      },
    });

    console.log('Transaction Hash:', transaction);

    if (transaction.swapReceipt.hash) {
      try {
        await new this.transactionModel({
          userId: user.userId,
          transactionType: 'buy',
          chain: 'sei',
          amount: amount,
          token: {
            address: tokenOut,
            tokenType: 'token',
          },
          txHash: transaction.swapReceipt.hash,
          meta: {
            platform: 'twitter',
            originalCommand,
          },
        }).save();
      } catch (err) {
        console.error('Failed to save transaction:', err.message);
      }
    }
    return `https://seitrace.com/tx/${transaction.swapReceipt.hash}`;
  }

  async sellToken(
    tokenIn: string,
    amount: string,
    user: User,
    originalCommand: string,
  ) {
    console.log('Swapping ....');
    console.log(amount);
    const nativeAddress = this.symphony.getConfig().nativeAddress;
    const tokenOut = nativeAddress;
    const walletClient = createWalletClient({
      chain: sei,
      transport: http(process.env.SEI_RPC),
      account: user.walletAddress as `0x${string}`,
    });
    let includesNative = false;

    const route = await this.symphony.getRoute(tokenIn, tokenOut, amount);

    if (tokenIn === nativeAddress || tokenOut === nativeAddress) {
      includesNative = true;
      console.log('Swapping ...., isNative');
    }
    const transaction = await swap({
      route: route.route,
      includesNative,
      walletClient,
      options: {
        skipApproval: true,
        skipCheckApproval: true,
      },
      slippage: {
        slippageAmount: '1',
        isRaw: true,
        isBps: false,
      },
    });

    console.log('Transaction Hash:', transaction);

    if (transaction.swapReceipt.hash) {
      try {
        await new this.transactionModel({
          userId: user.userId,
          transactionType: 'buy',
          chain: 'sei',
          amount: amount,
          token: {
            address: tokenOut,
            tokenType: 'token',
          },
          txHash: transaction.swapReceipt.hash,
          meta: {
            platform: 'twitter',
            originalCommand,
          },
        }).save();
      } catch (err) {
        console.error('Failed to save transaction:', err.message);
      }
    }
    return `https://seitrace.com/tx/${transaction.swapReceipt.hash}`;
  }

  // private async getERC20TokenContract(
  //   address: string,
  // ): Promise<ethers.Contract | any> {
  //   try {
  //     const signer = await this.provider.getSigner();
  //     const contract = new ethers.Contract(address, erc20Abi, signer);
  //     return contract;
  //   } catch (error) {
  //     console.error('Failed to get the contract:', error);
  //     throw error;
  //   }
  // }

  // private async wrapSEI(amount: string, privateKey: string) {
  //   const signer = new ethers.Wallet(privateKey, this.provider);
  //   const wrappedSEIAddress = '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7';
  //   const wrappedSEIContract = new ethers.Contract(
  //     wrappedSEIAddress,
  //     wrappedSEI_ABI,
  //     signer,
  //   );

  //   const value = ethers.parseUnits(amount, 18);

  //   const tx = await wrappedSEIContract.deposit({ value });
  //   await tx.wait();
  //   return `https://seitrace.com/tx/${tx.hash}`;
  // }

  // private async unwrapSEI(amount: string, privateKey: string) {
  //   const signer = new ethers.Wallet(privateKey, this.provider);
  //   const wrappedSEIAddress = '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7';
  //   const wrappedSEIContract = new ethers.Contract(
  //     wrappedSEIAddress,
  //     wrappedSEI_ABI,
  //     signer,
  //   );

  //   const value = ethers.parseUnits(amount, 18); // Convert WSEI amount to wei

  //   const tx = await wrappedSEIContract.withdraw(value);
  //   await tx.wait();
  //   return `https://seitrace.com/tx/${tx.hash}`;
  // }
}
