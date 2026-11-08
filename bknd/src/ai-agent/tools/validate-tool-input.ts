import { BadRequestException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import type { AiToolInput } from './base-tool.js';

export async function validateToolInput<T extends object>(dto: ClassConstructor<T>, input: AiToolInput): Promise<T> {
  const instance = plainToInstance(dto, input) as T;
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new BadRequestException(messages.length ? messages : '工具参数不符合要求。');
  }
  return instance;
}
