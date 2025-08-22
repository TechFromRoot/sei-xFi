import { Injectable, Logger } from '@nestjs/common';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { User } from 'src/database/schemas/user.schema';
import { DynamicWalletService } from 'src/wallet/dynamic-wallet.service';
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
  private provider = new ethers.JsonRpcProvider(process.env.SEI_RPC);
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
      const decryptedEvmWallet = await this.walletService.decryptEvmWallet(
        process.env.DYNAMIC_WALLET_SECRET!,
        user.walletDetails,
      );

      const { balance } = await this.walletService.getNativeEthBalance(
        user.walletAddress as `0x${string}`,
        process.env.SEI_RPC,
      );

      this.logger.log(balance);

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const txn = await this.walletService.transferEth(
        decryptedEvmWallet.privateKey,
        reciever,
        parseFloat(amount),
        process.env.SEI_RPC,
      );
      const receipt =
        txn?.wait && typeof txn.wait === 'function' ? await txn.wait() : txn;

      if (receipt.status === 1) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: txn,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://seitrace.com/tx/${receipt.transactionHash}`;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    decimals?: number,
  ) {
    try {
      const decryptedEvmWallet = await this.walletService.decryptEvmWallet(
        process.env.DYNAMIC_WALLET_SECRET!,
        user.walletDetails,
      );

      const { balance } = await this.walletService.getERC20Balance(
        user.walletAddress as `0x${string}`,
        token,
        process.env.SEI_RPC,
      );
      this.logger.log('Balance:', balance);

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferERC20(
        decryptedEvmWallet.privateKey,
        reciever,
        token,
        parseFloat(amount),
        process.env.SEI_RPC,
      );

      if (response.signature) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: response.signature,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://seitrace.com/tx/${response.signature}`;
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
    const decryptedEvmWallet = await this.walletService.decryptEvmWallet(
      process.env.DYNAMIC_WALLET_SECRET!,
      user.walletDetails,
    );

    const provider = new ethers.JsonRpcProvider(process.env.SEI_RPC);
    const signer = new ethers.Wallet(decryptedEvmWallet.privateKey, provider);
    let includesNative = false;

    const route = await this.symphony.getRoute(tokenIn, tokenOut, amount);

    if (tokenIn === nativeAddress || tokenOut === nativeAddress) {
      includesNative = true;
      console.log('Swapping ...., isNative');
    }
    const transaction = await swap({
      route: route.route,
      includesNative,
      signer,
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
    const decryptedEvmWallet = await this.walletService.decryptEvmWallet(
      process.env.DYNAMIC_WALLET_SECRET!,
      user.walletDetails,
    );
    const provider = new ethers.JsonRpcProvider(process.env.SEI_RPC);
    const signer = new ethers.Wallet(decryptedEvmWallet.privateKey, provider);
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
      signer,
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
    const decryptedEvmWallet = await this.walletService.decryptEvmWallet(
      process.env.DYNAMIC_WALLET_SECRET!,
      user.walletDetails,
    );
    const provider = new ethers.JsonRpcProvider(process.env.SEI_RPC);
    const signer = new ethers.Wallet(decryptedEvmWallet.privateKey, provider);
    let includesNative = false;

    const route = await this.symphony.getRoute(tokenIn, tokenOut, amount);

    if (tokenIn === nativeAddress || tokenOut === nativeAddress) {
      includesNative = true;
      console.log('Swapping ...., isNative');
    }
    const transaction = await swap({
      route: route.route,
      includesNative,
      signer,
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
