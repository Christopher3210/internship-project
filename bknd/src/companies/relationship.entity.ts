import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Stores the direct parent of each company in the supply-chain hierarchy. */
@Entity({ name: 'relationships' })
export class CompanyRelationship {
  @PrimaryColumn({ name: 'company_code', length: 32 })
  companyCode!: string;

  // `string | null` is reflected as Object at runtime, so PostgreSQL needs
  // an explicit varchar type for TypeORM to create and query this column.
  @Column({ name: 'parent_company', type: 'varchar', length: 32, nullable: true })
  parentCompany?: string | null;
}
