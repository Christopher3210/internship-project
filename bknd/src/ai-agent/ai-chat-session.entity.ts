import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

export type AiChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: AiChatAttachment[];
};

export type AiChatAttachment = {
  name: string;
  type: string;
  size: number;
  textContent?: string;
};

@Entity({ name: 'ai_chat_sessions' })
@Index('idx_ai_chat_sessions_owner_updated', ['owner', 'updatedAt'])
export class AiChatSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nullable only to keep legacy demo rows readable in the database; all API-created rows have an owner.
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  owner!: User | null;

  @RelationId((session: AiChatSession) => session.owner)
  userId!: string | null;

  @Column({ length: 160, default: '新对话' })
  title!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  messages!: AiChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
