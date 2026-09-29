import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 80, default: '' })
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ length: 80, default: 'Member' })
  role!: string;

  @Column({ length: 30, default: 'Active' })
  status!: string;

  @Column({ select: false })
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
