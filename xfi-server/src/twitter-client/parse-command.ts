import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { User } from 'src/database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { ethers } from 'ethers';
import { XfiDefiEthereumService } from 'src/xfi-defi/xfi-defi-ethereum.service';
import { TwitterClientBase } from './base.provider';
import { UserService } from './user.service';
import { XfiDefiSeiService } from 'src/xfi-defi/xfi-defi-sei.service';

type Action = 'buy' | 'sell' | 'send' | 'tip';
type TokenType = 'native' | 'stable' | 'token';
type ReceiverType = 'wallet' | 'ens' | 'username' | 'sns';
type Platform = 'twitter' | 'twitter-dm' | 'terminal';

interface Token {
  value: string;
  type: TokenType;
}

interface Receiver {
  address: string;
  type: ReceiverType;
  value?: string;
  userId?: string;
}

interface ParsedCommand {
  action: Action;
  chain?: string;
  amount?: string;
  token?: Token;
  receiver?: Receiver;
  isUSD?: boolean;
  inputToken?: string;
}

// --- Helper Data ---
const NATIVE_TOKENS = ['eth', 'sei'];
const STABLE_TOKENS = ['usdc', 'usdt'];

@Injectable()
export class ParseCommandService {
  private readonly logger = new Logger(ParseCommandService.name);
  private ethProvider: ethers.JsonRpcProvider;
  private provider = new ethers.JsonRpcProvider(process.env.SEI_RPC);
  constructor(
    private readonly walletService: WalletService,
    private readonly defiEthereumService: XfiDefiEthereumService,
    private readonly defiSeiService: XfiDefiSeiService,
    private readonly twitterClientBase: TwitterClientBase,
    private readonly userService: UserService,
    @InjectModel(User.name)
    readonly userModel: Model<User>,
  ) {
    this.ethProvider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
  }

  private getEnsChainType(identifier: string): string {
    if (identifier.startsWith('@')) {
      return 'twitter';
    }

    const parts = identifier.toLowerCase().split('.');

    if (parts.length === 3 && parts[2] === 'eth') {
      return parts[1]; // e.g., 'mantle' from 'dami.base.eth'
    }

    if (parts.length === 2 && parts[1] === 'eth') {
      return 'ethereum'; // e.g., 'dami.eth'
    }

    if (parts.length === 2 && parts[1] === 'sei') {
      return 'sei'; // e.g., 'dami.sei'
    }

    return 'unknown';
  }

  private convertChainIdToCoinType(chainId: number): string {
    if (chainId === 1) {
      return 'addr';
    }
    const coinType = (0x80000000 | chainId) >>> 0;
    return coinType.toString(16).toUpperCase();
  }

  private convertReverseNodeToBytes(address: string, chainId: number): string {
    const addressFormatted = address.toLowerCase();
    const addressNode = ethers.solidityPackedKeccak256(
      ['string'],
      [addressFormatted.substring(2)],
    );

    const coinType = this.convertChainIdToCoinType(chainId);
    const baseReverseNode = ethers.namehash(`${coinType}.reverse`);

    const addressReverseNode = ethers.solidityPackedKeccak256(
      ['bytes32', 'bytes32'],
      [baseReverseNode, addressNode],
    );

    return addressReverseNode;
  }

  private encodeDnsName(name: string): string {
    const labels = name.split('.');
    const buffers = labels.map((label) => {
      const len = Buffer.from([label.length]);
      const str = Buffer.from(label, 'utf8');
      return Buffer.concat([len, str]);
    });
    return ethers.hexlify(Buffer.concat([...buffers, Buffer.from([0])]));
  }

  detectChain(chainOrToken: string): string {
    const normalized = chainOrToken.toLowerCase();

    if (normalized.includes('sei')) return 'sei';
    if (/^0x[a-fA-F0-9]{40}$/.test(chainOrToken)) return 'ethereum'; // EVM
    return 'sei'; // Default fallback
  }

  detectTokenType(value: string): TokenType {
    const lower = value.toLowerCase();
    if (NATIVE_TOKENS.includes(lower)) return 'native';
    if (STABLE_TOKENS.includes(lower)) return 'stable';
    return 'token';
  }

  detectReceiverType(value: string): ReceiverType {
    if (value.endsWith('.eth') || value.endsWith('.base.eth')) return 'ens';
    if (value.endsWith('.sei')) return 'sns';
    if (value.startsWith('@')) return 'username';
    return 'wallet';
  }

  parseTweetCommand(tweet: string): ParsedCommand | null {
    const normalized = tweet.replace(/\s+/g, ' ').trim();

    // === SEND / TIP ===
    // const sendRegex =
    //   /(send|tip)\s+([\d.]+)\s+(\w+)\s+to\s+([a-zA-Z0-9.@]+)(?:\s+on\s+(\w+))?/i;
    // const sendRegex =
    //   /(send|tip)\s+\$?([\d]+(?:\.\d+)?)\s+\$?([A-Za-z0-9-]+)\s+to\s+([a-zA-Z0-9._@]+)(?:\s+on\s+(\w+))?/i;
    const sendRegex =
      /(send|tip)\s+(\$?)([\d]+(?:\.\d+)?)(\$?)\s+\$?([A-Za-z0-9-]+)\s+to\s+([a-zA-Z0-9._@]+)(?:\s+on\s+(\w+))?/i;
    const sendMatch = normalized.match(sendRegex);
    if (sendMatch) {
      // const [, actionRaw, amount, tokenValue, receiverValue, chainMaybe] =
      //   sendMatch;

      const [
        ,
        // full match
        actionRaw, // "send" | "tip"
        dollarSignBefore, // "$" if present before amount, "" if not
        amount, // the number
        dollarSignAfter,
        tokenValue, // token symbol or address
        receiverValue, // recipient
        chainMaybe, // optional chain
      ] = sendMatch;

      const isUSD = dollarSignBefore === '$' || dollarSignAfter === '$';
      const action = actionRaw.toLowerCase() as Action;

      return {
        action,
        amount,
        token: {
          value: tokenValue,
          type: this.detectTokenType(tokenValue),
        },
        receiver: {
          address: receiverValue,
          value: receiverValue,
          type: this.detectReceiverType(receiverValue),
        },
        chain: this.detectChain(chainMaybe ?? tokenValue),
        isUSD,
      };
    }

    // // === BUY / SELL: [amount][token] of [targetToken] ===
    // const buySellOfRegex =
    //   /(buy|sell)\s+([\d.]+)\s*([a-zA-Z]+)\s+(?:worth\s+of|of)\s+([a-zA-Z0-9]+)(?:\s+on\s+(\w+))?/i;
    // const buySellOfMatch = normalized.match(buySellOfRegex);
    // if (buySellOfMatch) {
    //   const [, actionRaw, amount, payToken, targetToken, chainMaybe] =
    //     buySellOfMatch;
    //   return {
    //     action: actionRaw.toLowerCase() as Action,
    //     amount,
    //     token: {
    //       value: targetToken,
    //       type: this.detectTokenType(targetToken),
    //     },
    //     chain: this.detectChain(chainMaybe ?? payToken),
    //   };
    // }

    // === BUY : [token] for [amount][payToken] ===
    // const buySellForRegex =
    //   /(buy|sell)\s+([a-zA-Z0-9]+)\s+for\s+([\d.]+)\s*([a-zA-Z]+)(?:\s+on\s+(\w+))?/i;
    // const buyRegex =
    //   /(buy)\s+(0x[a-fA-F0-9]{40}|\$?[A-Za-z0-9-]+)\s+(?:for)\s+([\d]+(?:\.\d+)?)\s*\$?([A-Za-z0-9-]+)/i;

    const buyRegex =
      /(buy|swap)\s+(?:(\$?)([\d]+(?:\.\d+)?)(\$?)\s+)?(0x[a-fA-F0-9]{40}|\$?[A-Za-z0-9-]+)(?:\s+(for|of)\s+(?:(\$?)([\d]+(?:\.\d+)?)(\$?)\s+)?(\$?[A-Za-z0-9-]+))?/i;

    const buySellForMatch = normalized.match(buyRegex);
    if (buySellForMatch) {
      const [
        ,
        actionRaw,
        dollarBefore,
        amount,
        dollarAfter,
        targetToken,
        keyword,
        inDollarBefore,
        inAmount,
        inDollarAfter,
        inputToken,
      ] = buySellForMatch;

      const isUSD =
        dollarBefore === '$' ||
        dollarAfter === '$' ||
        inDollarBefore === '$' ||
        inDollarAfter === '$';
      console.log('keyword :', keyword);
      return {
        action: actionRaw.toLowerCase() as Action,
        amount: amount || inAmount || null,
        token: {
          value: targetToken,
          type: this.detectTokenType(targetToken),
        },
        isUSD,
        inputToken: inputToken || null,
      };
    }

    // === SELL all / half / percent ===
    // const sellPercentageRegex =
    //   /sell\s+(all|half|\d{1,3}%)\s+(?:of\s+)?([a-zA-Z0-9]+)(?:\s+on\s+(\w+))?/i;
    // const sellRegex =
    //   /(sell)\s+(all|100%|[\d]+(?:\.\d+)?%)?\s*(0x[a-fA-F0-9]{40}|\$?[A-Za-z0-9-]+)/i;
    const sellRegex =
      /^(sell)\s+(all|\d+(?:\.\d+)?%?|\$?\d+(?:\.\d+)?|\d+\$)\s+(?:of\s+)?(\$?[A-Za-z0-9-]+|0x[a-fA-F0-9]{4,})$/i;
    const sellMatch = normalized.match(sellRegex);
    console.log(normalized);
    console.log('match :', sellMatch);
    if (sellMatch) {
      const [, action, rawAmount, tokenValue] = sellMatch;

      const isUSD = rawAmount.startsWith('$') || rawAmount.endsWith('$');
      return {
        action: action.toLowerCase() as Action,
        amount: rawAmount,
        token: {
          value: tokenValue,
          type: this.detectTokenType(tokenValue),
        },
        isUSD,
      };
    }

    return null;
  }

  // --- Placeholder Action Handlers ---

  async resolveENS(name: string): Promise<Receiver> {
    console.log('name  :', name);
    const ensChain = this.getEnsChainType(name);
    console.log(ensChain);
    switch (ensChain) {
      case 'ethereum':
        const ethAddress = await this.ethProvider.resolveName(name);
        console.log('ens name:', ethAddress);
        return {
          address: ethAddress,
          type: 'ens',
          value: name,
        };

      case 'twitter':
        try {
          const cleanUsername = name.replace(/^@/, '');
          const user = await this.twitterClientBase.fetchProfile(cleanUsername);
          console.log('User :', user);
          if (!user) {
            throw new Error('user does not exist');
          }
          const userExist = await this.getOrCreateUser({
            id: user.id,
            username: user.username,
          });
          if (!userExist) {
            throw new Error('error creating User');
          }
          return {
            address: userExist.walletAddress,
            type: 'username',
            value: name,
            userId: user.id,
          };
        } catch (error) {
          console.log(error);
          return;
        }

      default:
        return {
          address: process.env.ADMIN_WALLET_EVM,
          type: 'ens',
          value: name,
        };
    }
  }

  async handleNativeSend(
    chain: string,
    to: string,
    amount: string,
    user: User,
    originalCommand: string,
    platform: Platform = 'twitter',
    isUSD?: boolean,
    ensOrUsername?: string,
  ) {
    console.log(`Sending ${amount} native on ${chain} to ${to}`);
    try {
      if (chain == 'sei') {
        const data: Partial<Transaction> = {
          userId: user.userId,
          transactionType: 'send',
          chain: 'sei',
          amount: amount,
          token: { address: 'sei', tokenType: 'native' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: platform,
            originalCommand: originalCommand,
          },
        };
        const response = await this.defiSeiService.sendSEI(
          user,
          amount,
          to,
          data,
          isUSD ? isUSD : false,
          ensOrUsername ? ensOrUsername : null,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async handleERC20Send(
    chain: string,
    token: string,
    to: string,
    amount: string,
    user: User,
    originalCommand: string,
    platform: Platform = 'twitter',
    isUSD?: boolean,
    ensOrUsername?: string,
  ) {
    console.log(`Sending ${amount} stable ${token} on ${chain} to ${to}`);

    try {
      if (chain == 'sei') {
        const data: Partial<Transaction> = {
          userId: user.userId,
          transactionType: 'send',
          chain: 'sei',
          amount: amount,
          token: { address: token, tokenType: 'stable' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: platform,
            originalCommand: originalCommand,
          },
        };
        const response = await this.defiSeiService.sendERC20(
          user,
          token,
          amount,
          to,
          data,
          isUSD ? isUSD : false,
          ensOrUsername ? ensOrUsername : null,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async handleBuy(
    chain: string,
    token: string,
    nativeAmount: string,
    user: User,
    originalCommand: string,
    platform: Platform = 'twitter',
    isUSD?: boolean,
    inputToken?: string,
  ) {
    try {
      const data: Partial<Transaction> = {
        userId: user.userId,
        transactionType: 'buy',
        chain: 'sei',
        amount: isUSD ? `$${nativeAmount}` : nativeAmount,
        token: { address: 'sei', tokenType: 'native' },
        tokenIn: `${inputToken}` || 'sei',
        tokenOut: token,
        meta: {
          platform: platform,
          originalCommand: originalCommand,
        },
      };

      const response = await this.defiSeiService.buyToken(
        token,
        nativeAmount,
        user,
        data,
        isUSD ? isUSD : false,
        inputToken ? inputToken : null,
      );
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  async handleSell(
    chain: string,
    token: string,
    amount: string,
    user: User,
    originalCommand: string,
    platform: Platform = 'twitter',
    isUSD?: boolean,
  ) {
    console.log(`Selling ${amount}% of ${token}`);
    try {
      const data: Partial<Transaction> = {
        userId: user.userId,
        transactionType: 'buy',
        chain: 'sei',
        amount: isUSD ? `$${amount}` : amount,
        token: { address: token, tokenType: 'token' },
        tokenIn: token,
        tokenOut: 'sei',
        meta: {
          platform: platform,
          originalCommand: originalCommand,
        },
      };
      const response = await this.defiSeiService.sellToken(
        token,
        amount,
        user,
        originalCommand,
        data,
        isUSD ? isUSD : false,
      );
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  // --- 🎯 BUNDLED ENTRY FUNCTION ---
  async handleTweetCommand(
    tweet: string,
    userId: string,
    username?: string,
    platform: Platform = 'twitter',
  ) {
    const normalized = tweet.replace(/\s+/g, ' ').trim();

    const balanceRegex =
      /\b(?:get(?:\s+me)?|check|show|see|what(?:'|’)?s|what\s+is|can\s+you\s+get|i\s+want\s+to\s+see)?\s*(?:my\s*)?(?:(sei|ethereum)\s+)?balance(?:\s*(?:on|of|for)?\s*(sei|ethereum|eth))?\b/i;

    // for directMessages
    const createAccountRegex =
      /\b((c(?:rea|ret|re)te?|a(?:ctiv|ctvat|ctiv)ate?)( (my )?(new )?account)?|i want (to )?(c(?:rea|ret|re)te?|a(?:ctiv|ctvat|ctiv)ate?)(( a)?( new)?( my)? account)?)\b/i;

    const walletRegex =
      /\b(?:get(?:\s+me)?|show|see|what(?:'|’)?s|what\s+is|can\s+you\s+show|i\s+want\s+to\s+see|give(?:\s+me)?)?\s*(?:my\s*)?(wallet(?:\s+address)?|wallet\s+addr|walletaddr|walletaddress)\b/i;

    const createAccountMatch = normalized.match(createAccountRegex);
    const balanceMatch = normalized.toLowerCase().match(balanceRegex);
    const getWalletMatch = normalized.toLowerCase().match(walletRegex);
    const appUrl = process.env.APP_URL;

    try {
      this.logger.log(tweet);
      const user = await this.userModel.findOne({ userId });

      if (!user || !user.isActive) {
        // === CREATE / ACTIVATE ACCOUNT ===
        if (createAccountMatch) {
          if (user) {
            const updatedUser = await this.userModel.findOneAndUpdate(
              { userId: user.userId },
              { isActive: true },
              { new: true },
            );

            return `Account Activated\n\nEVM ADDRESS:\n${updatedUser.walletAddress}`;
          } else {
            const newUser = await this.getOrCreateUser(
              {
                id: userId,
                username: username,
              },
              true,
            );
            return `Account created\n\nEVM ADDRESS:\n${newUser.walletAddress}`;
          }
        }

        return `Please go to ${appUrl} create/activate your account to use this bot`;
      } else if (balanceMatch) {
        return `Please go to ${appUrl} to check your account balance`;
      } else if (createAccountMatch || getWalletMatch) {
        return `Your Account:\n\nEVM ADDRESS:\n${user.walletAddress}`;
      }

      const parsed = this.parseTweetCommand(tweet);
      console.log('parsed :', parsed);
      if (!parsed) {
        console.error('Invalid tweet format.');
        const promptDocsUrl = process.env.PROMPT_DOC;
        return `Hi, if you’re trying to use a command or just curious how I work, you can check out the terminal at ${appUrl} or the available prompts and formats here:👉  ${promptDocsUrl}`;
      }

      const { action, chain, amount, token, receiver, isUSD, inputToken } =
        parsed;
      let to: Receiver;

      if (receiver) {
        if (receiver.type === 'ens' || receiver.type === 'username') {
          //TODO:
          to = await this.resolveENS(receiver.value);
        } else {
          to = {
            address: receiver.value,
            type: 'wallet',
            value: receiver.value,
          };
        }
      }

      switch (action) {
        case 'send':
        case 'tip':
          if (!to) return console.error('Receiver address missing.');
          if (token.type === 'native') {
            const nativeResponse = await this.handleNativeSend(
              chain,
              to.address,
              amount,
              user,
              tweet,
              platform,
              isUSD,
              to.type !== 'wallet' ? to.value : null,
            );

            return nativeResponse;
          }

          if (token.type === 'stable' || token.type === 'token') {
            const stableResponse = await this.handleERC20Send(
              chain,
              token.value,
              to.address,
              amount,
              user,
              tweet,
              platform,
              isUSD,
              to.type !== 'wallet' ? to.value : null,
            );
            return stableResponse;
          }

        case 'buy':
          return this.handleBuy(
            chain,
            token.value,
            amount,
            user,
            tweet,
            platform,
            isUSD,
            inputToken,
          );

        case 'sell':
          return this.handleSell(
            chain,
            token.value,
            amount,
            user,
            tweet,
            platform,
            isUSD,
          );
      }
    } catch (error) {
      console.log(error);
    }
  }

  private async getOrCreateUser(
    user: { id: string; username: string },
    dm?: boolean,
  ) {
    let existingUser = await this.userModel.findOne({ userId: user.id });

    if (!existingUser) {
      const newEvmWallet = await this.walletService.createEvmWallet();

      const encryptedEvmWalletDetails =
        await this.walletService.encryptEvmWallet(
          process.env.DYNAMIC_WALLET_SECRET!,
          newEvmWallet.privateKey,
        );

      existingUser = new this.userModel({
        userId: user.id,
        userName: user.username,
        walletAddress: newEvmWallet.address,
        walletDetails: encryptedEvmWalletDetails.json,
        isActive: dm ? true : false, // make account active if it was a directmessage comamnd
      });
      return existingUser.save();
    }

    return existingUser;
  }

  private normalizeChain = (raw) => {
    if (!raw) return null;
    const value = raw.toLowerCase();
    if (value === 'sei' || value === 'sei') return 'sei';
    if (value === 'eth' || value === 'ethereum') return 'ethereum';
    if (value === 'sei') return 'sei';
    return null;
  };

  // to formate directMessge balance response
  private formatBalances(balances: Record<string, any[]>): string {
    let result = 'BALANCE:\n\n';

    for (const [chain, tokens] of Object.entries(balances)) {
      result += `chain: ${chain}\n`;

      for (const token of tokens) {
        const amountNum =
          typeof token.amount === 'number'
            ? token.amount
            : parseFloat(token.amount);

        const formattedAmount = Number(amountNum).toPrecision(4);
        result += `${formattedAmount} - ${token.tokenSymbol}\n`;
      }

      result += `\n`; // extra newline between chains
    }

    return result.trim(); // remove last extra newline
  }
}
