import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { UserService } from 'src/twitter-client/user.service';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  private readonly saltRounds = 10;
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UserService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async authenticate(userId: string, userName: string) {
    let user = await this.userModel.findOne({ userId }).exec();
    if (!user) {
      this.logger.log(`User with ID ${userId} not found. Creating new user.`);
      user = await this.usersService.createUser({ userId, userName });
    } else {
      this.logger.log(`User with ID ${userId} found.`);
    }

    const jwt = await this.generateJwt(user);
    return { jwt, user };
  }

  async generateJwt(user: UserDocument) {
    const payload = {
      sub: user.userId,
      username: user.userName,
      userId: user.userId,
    };

    return this.jwtService.sign(payload);
  }
}
