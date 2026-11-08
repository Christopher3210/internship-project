import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity({ name: 'ai_operation_audit' })
@Index('idx_ai_operation_audit_owner_created', ['owner', 'createdAt'])
@Index('idx_ai_operation_audit_action_created', ['action', 'createdAt'])
export class AiOperationAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  // Preserve audit tenant ownership even after its user is deleted (FK becomes NULL).
  @Index('idx_ai_audit_tenant')
  @Column({ name: 'tenant_id', length: 120, default: 'local' }) tenantId!: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' }) owner!: User | null;
  @RelationId((audit: AiOperationAudit) => audit.owner) userId!: string | null;
  @Column({ length: 100 }) action!: string;
  @Column({ name: 'resource_type', length: 100 }) resourceType!: string;
  @Column({ name: 'resource_id', type: 'varchar', length: 160, nullable: true }) resourceId!: string | null;
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true }) ipAddress!: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) details!: Record<string, unknown>;
  @CreateDateColumn() createdAt!: Date;
}
