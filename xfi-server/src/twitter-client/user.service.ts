import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { DynamicWalletService } from 'src/wallet/dynamic-wallet.service';

export interface SolAsset {
  tokenName: string;
  tokenSymbol: string;
  tokenMint: string;
  amount: string;
}
export type EvmChain = 'ethereum' | 'sei';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly walletService: WalletService,
    private readonly dynamicWalletService: DynamicWalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const newEvmWallet = await this.dynamicWalletService.createWallet();

      const user = new this.userModel({
        userId: createUserDto.userId,
        userName: createUserDto.userName,
        walletAddress: newEvmWallet.accountAddress,
        walletID: newEvmWallet.walletId,
        chains: createUserDto.chains,
      });
      return user.save();
    } catch (error) {
      console.log(error);
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      updateUserDto,
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userModel
      .findOne({ userId })
      .select('-evmWalletDetails')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async checkIfUserExists(userId: string): Promise<User> {
    return await this.userModel
      .findOne({ userId })
      .select('-evmWalletDetails -svmWalletDetails')
      .exec();
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return transactions;
  }

  async getUserEVMBalance(
    userId: string,
    chain: EvmChain,
  ): Promise<SolAsset[]> {
    const user = await this.userModel.findOne({ userId });
    if (!user) throw new NotFoundException('User not found');

    switch (chain) {
      case 'ethereum': {
        const [ethBalance, usdcBalance, usdtBalance] = await Promise.all([
          this.walletService.getNativeEthBalance(
            user.walletAddress,
            process.env.ETHEREUM_RPC,
          ),
          this.walletService.getERC20Balance(
            user.walletAddress,
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            process.env.ETHEREUM_RPC,
          ),
          this.walletService.getERC20Balance(
            user.walletAddress,
            '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            process.env.ETHEREUM_RPC,
          ),
        ]);

        return [
          {
            tokenName: 'ethereum',
            tokenSymbol: 'ETH',
            tokenMint: '0x0000000000000000000000000000000000000000',
            amount: ethBalance.balance.toString(),
          },
          {
            tokenName: 'usdc',
            tokenSymbol: 'USDC',
            tokenMint: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: usdcBalance.balance.toString(),
          },
          {
            tokenName: 'usdt',
            tokenSymbol: 'USDT',
            tokenMint: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            amount: usdtBalance.balance.toString(),
          },
        ];
      }

      case 'sei': {
        const [ethBalance, usdcBalance, usdtBalance] = await Promise.all([
          this.walletService.getNativeEthBalance(
            user.walletAddress,
            process.env.MANTLE_RPC,
          ),
          this.walletService.getERC20Balance(
            user.walletAddress,
            '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9',
            process.env.MANTLE_RPC,
          ),
          this.walletService.getERC20Balance(
            user.walletAddress,
            '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
            process.env.MANTLE_RPC,
          ),
        ]);

        return [
          {
            tokenName: 'SEI',
            tokenSymbol: 'SEI',
            tokenMint: '0x0000000000000000000000000000000000000000',
            amount: ethBalance.balance.toString(),
          },
          {
            tokenName: 'usdc',
            tokenSymbol: 'USDC',
            tokenMint: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
            amount: usdcBalance.balance.toString(),
          },
          {
            tokenName: 'usdt',
            tokenSymbol: 'USDT',
            tokenMint: '0x9151434b16b9763660705744891fA906F660EcC5',
            amount: usdtBalance.balance.toString(),
          },
        ];
      }

      default:
        throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
  }
}
