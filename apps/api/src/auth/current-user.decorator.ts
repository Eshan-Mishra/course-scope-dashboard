import { AuthenticatedUser } from '@course-scope/contracts';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    (context.switchToHttp().getRequest<Request>() as Request & { user: AuthenticatedUser }).user,
);
