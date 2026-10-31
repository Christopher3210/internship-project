import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity({ name: 'ai_user_memory' })
@Index('idx_ai_user_memory_owner_key', ['owner', 'key'], { unique: true })
export class AiUserMemory {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' }) owner!: User;
  @RelationId((memory: AiUserMemory) => memory.owner) userId!: string;
  @Column({ length: 120 }) key!: string;
  @Column({ type: 'jsonb' }) value!: unknown;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
