import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'companies' })
export class Company {
  @PrimaryColumn({ name: 'company_code', length: 32 })
  companyCode!: string;

  @Column({ name: 'company_name', length: 160 })
  companyName!: string;

  @Column({ type: 'int' })
  level!: number;

  @Column({ length: 80 })
  country!: string;

  @Column({ length: 80 })
  city!: string;

  @Column({ name: 'founded_year', type: 'int' })
  foundedYear!: number;

  @Column({ name: 'annual_revenue', type: 'int' })
  annualRevenue!: number;

  @Column({ type: 'int' })
  employees!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
