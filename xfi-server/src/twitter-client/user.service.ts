import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';

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
    private readonly httpService: HttpService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserDocument> {
    try {
      const newEvmWallet = await this.walletService.createEvmWallet();
      const encryptedEvmWalletDetails =
        await this.walletService.encryptEvmWallet(
          process.env.DYNAMIC_WALLET_SECRET!,
          newEvmWallet.privateKey,
        );

      const user = new this.userModel({
        userId: createUserDto.userId,
        userName: createUserDto.userName,
        profileImage: createUserDto.profileImage ?? '',
        walletAddress: newEvmWallet.address,
        walletDetails: encryptedEvmWalletDetails.json,
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
    const user = await this.userModel
      .findOneAndUpdate({ userId }, updateUserDto, { new: true })
      .select('-walletDetails');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userModel
      .findOne({ userId })
      .select('-walletDetails')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async checkIfUserExists(userId: string): Promise<User> {
    return await this.userModel
      .findOne({ userId })
      .select('-walletDetails')
      .exec();
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return transactions;
  }

  async getUserWalletBalance(userId: string): Promise<any> {
    const user = await this.userModel.findOne({ userId });
    if (!user) throw new NotFoundException('User not found');

    // const balance = await this.httpService.axiosRef.get(
    //   `${process.env.BALANCE_API}?id=${user.walletAddress}&is_all=true&chain_id=sei`,
    // );

    const balanceProxys = await this.httpService.axiosRef.get(
      `${process.env.BALANCE_PROXY}/balance?address=${user.walletAddress}`,
    );

    return balanceProxys.data.data.map((token) => ({
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      amount: token.amount,
      raw_amount: token.raw_amount,
      token_usd_price: token.price,
      amount_usd_value: token.amount * token.price,
      logo: token.logo_url,
    }));
  }
}
