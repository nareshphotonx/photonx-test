import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with tenant slug and identifier' })
  @ApiBody({
    type: Object,
    examples: {
      email: {
        value: {
          tenantSlug: 'acme-india',
          email: 'admin@acme.com',
          password: 'StrongPass@123',
        },
      },
      phone: {
        value: {
          tenantSlug: 'acme-india',
          phone: '+919999999999',
          password: 'StrongPass@123',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Returns access and refresh tokens' })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    const userAgent = request.headers['user-agent'];

    return this.authService.login(dto, {
      userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
      ipAddress: request.ip,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiOkResponse({ description: 'Returns rotated token pair' })
  refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    const userAgent = request.headers['user-agent'];

    return this.authService.refresh(dto, {
      userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current authenticated session' })
  @ApiOkResponse({ description: 'Session revoked' })
  logout(
    @Body() dto: LogoutDto,
    @CurrentUser() user: Express.User,
  ): Promise<{ revoked: boolean }> {
    return this.authService.logout(dto, user);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ description: 'Returns tenant scoped profile' })
  me(@CurrentUser() user: Express.User): Promise<{
    id: string;
    tenantId: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    permissions: string[];
  }> {
    return this.authService.me(user);
  }
}
