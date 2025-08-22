import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.auth_token;
    const response: Response = context.switchToHttp().getResponse();

    console.log('token:', token);
    if (!token) {
      response.redirect('http://localhost:5173/');
      return false;
    }

    try {
      const payload = await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      console.log('this is payload ', payload);
      request.user = payload;
      return true;
    } catch {
      response.redirect('http://localhost:5173/');
      return false;
    }
  }
}

// @UseGuards(JwtAuthGuard)
