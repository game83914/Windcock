import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser } from './current-user.decorator';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, request.ip);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request.ip);
  }

  @Post('password/change')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.userId);
  }
}
