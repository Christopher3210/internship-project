import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Stores the direct parent of each company in the supply-chain hierarchy. */
@Entity({ name: 'relationships' })
export class CompanyRelationship {
  @PrimaryColumn({ name: 'company_code', length: 32 })
  companyCode!: string;

  @Column({ name: 'parent_company', length: 32, nullable: true })
  parentCompany?: string | null;
}
