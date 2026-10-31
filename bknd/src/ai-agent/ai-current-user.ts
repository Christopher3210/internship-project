import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AiAuthenticatedUser = { id: string; email: string };

export const AiCurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AiAuthenticatedUser => {
  const request = context.switchToHttp().getRequest<{ user: AiAuthenticatedUser }>();
  return request.user;
});
