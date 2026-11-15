import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { UsersService } from '../../users/users.service.js';
import { CompaniesService } from '../../companies/companies.service.js';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';
import { UpdateUserDto } from '../../users/dto/update-user.dto.js';
import { DeleteUsersDto } from '../../users/dto/delete-users.dto.js';
import { CreateCompanyDto } from '../../companies/dto/create-company.dto.js';
import { UpdateCompanyDto } from '../../companies/dto/update-company.dto.js';
import { AiToolPermissionService } from '../tools/tool-permission.service.js';
import { AiTenantScopeService } from '../ai-tenant-scope.service.js';
import { validateToolInput } from '../tools/validate-tool-input.js';
import type { AiToolInput, AiToolContext } from '../tools/base-tool.js';

export type WriteOperation = 'userCreateTool' | 'userUpdateTool' | 'userDeleteTool' | 'userBatchDeleteTool' | 'companyCreateTool' | 'companyUpdateTool' | 'companyDeleteTool';

@Injectable()
export class WritePrevalidationService {
  constructor(private readonly permissions: AiToolPermissionService, private readonly tenants: AiTenantScopeService,
    private readonly users: UsersService, private readonly companies: CompaniesService) {}

  async validate(operation: WriteOperation, input: AiToolInput, context?: AiToolContext): Promise<AiToolInput> {
    if (!context?.actor?.id) throw new ForbiddenException('Authenticated identity required');
    const userOperation = operation.startsWith('user');
    await this.permissions.assertCanExecute(userOperation ? 'ai:users:write' : 'ai:companies:write', context.actor.id);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Input must be an object');
    if (operation === 'userCreateTool') {
      const dto = await validateToolInput(CreateUserDto, input);
      await this.users.validateCreate(dto);
      return { ...dto };
    }
    if (operation === 'companyCreateTool') {
      const dto = await validateToolInput(CreateCompanyDto, input);
      await this.companies.validateCreate(dto);
      return { ...dto };
    }
    if (operation === 'userBatchDeleteTool') {
      const dto = await validateToolInput(DeleteUsersDto, input);
      for (const id of dto.ids) this.assertTenant(context.actor.id, id);
      await this.users.validateDelete(dto.ids);
      return { ids: [...new Set(dto.ids)] };
    }
    const { id, companyCode, changes, ...extra } = input;
    if (Object.keys(extra).length || (userOperation ? companyCode !== undefined : id !== undefined)) throw new BadRequestException('Unexpected tool parameters');
    if (userOperation) {
      if (typeof id !== 'string' || !isUUID(id, '4')) throw new BadRequestException('id must be a UUID');
      this.assertTenant(context.actor.id, id);
      if (operation === 'userDeleteTool') {
        if (changes !== undefined) throw new BadRequestException('Unexpected changes');
        await this.users.validateDelete([id]);
        return { id };
      }
      const dto = await validateToolInput(UpdateUserDto, this.changes(changes));
      await this.users.validateUpdate(id, dto);
      return { id, changes: { ...dto } };
    }
    if (typeof companyCode !== 'string' || !companyCode.trim() || companyCode.length > 32) throw new BadRequestException('companyCode must be a non-empty string up to 32 characters');
    if (operation === 'companyDeleteTool') {
      if (changes !== undefined) throw new BadRequestException('Unexpected changes');
      await this.companies.validateDelete(companyCode);
      return { companyCode };
    }
    const dto = await validateToolInput(UpdateCompanyDto, this.changes(changes));
    if (dto.companyCode !== undefined && dto.companyCode !== companyCode) throw new BadRequestException('Company code cannot be changed');
    await this.companies.validateUpdate(companyCode, dto);
    return { companyCode, changes: { ...dto } };
  }

  private changes(value: unknown): AiToolInput {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new BadRequestException('changes must be a non-empty object');
    return value as AiToolInput;
  }
  private assertTenant(actor: string, target: string) {
    if (!this.tenants.sameTenant(actor, target)) throw new ForbiddenException('Cross-tenant access denied');
  }
}
