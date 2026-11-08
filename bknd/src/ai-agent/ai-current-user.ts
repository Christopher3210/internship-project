import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AiAuthenticatedUser = { id: string; email: string; ip?: string };

export const AiCurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AiAuthenticatedUser => {
  const request = context.switchToHttp().getRequest<{ user: AiAuthenticatedUser; ip?: string }>();
  return { ...request.user, ip: request.ip };
});
