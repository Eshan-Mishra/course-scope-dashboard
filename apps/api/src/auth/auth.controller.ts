import { AuthenticatedUser } from '@course-scope/contracts';
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService, RequestContext } from './auth.service';
import { ACCESS_COOKIE, ACCESS_TOKEN_TTL_MS, REFRESH_COOKIE, REFRESH_TOKEN_TTL_MS } from './auth.constants';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, MfaCodeDto, MfaSetupDto, PasswordResetConfirmDto, PasswordResetRequestDto } from './login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input.email, input.password, input.mfaCode, this.context(request));
    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(request.cookies?.[REFRESH_COOKIE] as string | undefined, this.context(request));
    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(
      request.cookies?.[REFRESH_COOKIE] as string | undefined,
      request.cookies?.[ACCESS_COOKIE] as string | undefined,
      this.context(request),
    );
    this.clearSessionCookies(response);
  }

  @Post('password-reset/request')
  @HttpCode(202)
  requestPasswordReset(@Body() input: PasswordResetRequestDto, @Req() request: Request) {
    return this.auth.requestPasswordReset(input.email, this.context(request));
  }

  @Post('password-reset/confirm')
  @HttpCode(204)
  confirmPasswordReset(@Body() input: PasswordResetConfirmDto, @Req() request: Request): Promise<void> {
    return this.auth.confirmPasswordReset(input.token, input.newPassword, this.context(request));
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: AuthenticatedUser, @Body() input: MfaSetupDto, @Req() request: Request) {
    return this.auth.setupMfa(user, input.password, this.context(request));
  }

  @Post('mfa/confirm')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  confirmMfa(@CurrentUser() user: AuthenticatedUser, @Body() input: MfaCodeDto, @Req() request: Request) {
    return this.auth.confirmMfa(user, input.code, this.context(request));
  }

  @Get('audit')
  @UseGuards(JwtAuthGuard)
  audit(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.auth.auditLogs(user, Number(limit) || 50);
  }

  private context(request: Request): RequestContext {
    return {
      ipAddress: request.ip || request.socket.remoteAddress || null,
      userAgent: request.get('user-agent')?.slice(0, 300) ?? null,
    };
  }

  private setSessionCookies(response: Response, accessToken: string, refreshToken: string): void {
    const secure = process.env.NODE_ENV === 'production';
    response.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: ACCESS_TOKEN_TTL_MS,
      path: '/',
    });
    response.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: '/auth',
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }
}
