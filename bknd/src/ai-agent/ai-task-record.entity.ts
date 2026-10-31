import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

export type AiTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

@Entity({ name: 'ai_task_record' })
@Index('idx_ai_task_record_owner_status_created', ['owner', 'status', 'createdAt'])
export class AiTaskRecord {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' }) owner!: User;
  @RelationId((task: AiTaskRecord) => task.owner) userId!: string;
  @Column({ length: 100 }) taskType!: string;
  @Column({ type: 'varchar', length: 20, default: 'queued' }) status!: AiTaskStatus;
  @Column({ type: 'smallint', default: 0 }) progress!: number;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) input!: Record<string, unknown>;
  @Column({ type: 'jsonb', nullable: true }) result!: unknown;
  @Column({ type: 'text', nullable: true }) error!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
