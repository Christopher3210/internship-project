import { ConflictException, Injectable, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { AiQueryCacheService } from '../ai-agent/ai-query-cache.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { Company } from './company.entity.js';
import { normalizeCountry } from './normalize-country.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { CompanyRelationship } from './relationship.entity.js';

type CsvCompany = Omit<Company, 'createdAt' | 'updatedAt'>;
type CsvRelationship = Pick<CompanyRelationship, 'companyCode' | 'parentCompany'>;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) { values.push(value); value = ''; } else value += character;
  }
  values.push(value);
  return values;
}

@Injectable()
export class CompaniesService implements OnModuleInit {
  constructor(
    @InjectRepository(Company) private readonly companiesRepository: Repository<Company>,
    @InjectRepository(CompanyRelationship) private readonly relationshipsRepository: Repository<CompanyRelationship>,
    @Optional() private readonly queryCache?: AiQueryCacheService,
  ) {}

  async onModuleInit() {
    if ((await this.companiesRepository.count()) >= 2000 && (await this.relationshipsRepository.count()) >= 2000) return;
    const dataDirectory = join(process.cwd(), 'data');
    const [companiesCsv, relationshipsCsv] = await Promise.all([
      readFile(join(dataDirectory, 'companies_0708.csv'), 'utf8'),
      readFile(join(dataDirectory, 'relationships_0708.csv'), 'utf8'),
    ]);
    const companies = companiesCsv.trim().split(/\r?\n/).slice(1).map((line): CsvCompany => {
      const [companyCode, companyName, level, country, city, foundedYear, annualRevenue, employees] = parseCsvLine(line);
      return { companyCode, companyName, level: Number(level), country, city, foundedYear: Number(foundedYear), annualRevenue: Number(annualRevenue), employees: Number(employees) };
    });
    const relationships = relationshipsCsv.trim().split(/\r?\n/).slice(1).map((line): CsvRelationship => {
      const [companyCode, parentCompany] = parseCsvLine(line);
      return { companyCode, parentCompany: parentCompany || null };
    });
    await this.companiesRepository.upsert(companies, ['companyCode']);
    await this.relationshipsRepository.upsert(relationships, ['companyCode']);
    await this.queryCache?.invalidate('COMPANIES');
  }

  async findAll(name?: string, levels?: string, page?: string, pageSize?: string) {
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);
    const currentPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const currentPageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, 100)
      : 20;
    const query = this.companiesRepository.createQueryBuilder('company')
      .leftJoin(CompanyRelationship, 'relationship', 'relationship.company_code = company.company_code')
      .addSelect('relationship.parent_company', 'parentCompany');
    if (name?.trim()) query.where('company.companyName ILIKE :name', { name: `%${name.trim()}%` });
    const selectedLevels = (levels ?? '').split(',').map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 4);
    if (selectedLevels.length) query.andWhere('company.level IN (:...levels)', { levels: selectedLevels });
    const total = await query.getCount();
    const { entities, raw } = await query
      .orderBy('company.level', 'ASC')
      .addOrderBy('company.companyCode', 'ASC')
      .skip((currentPage - 1) * currentPageSize)
      .take(currentPageSize)
      .getRawAndEntities();
    const items = entities.map((company, index) => ({
      companyCode: company.companyCode,
      companyName: company.companyName,
      level: company.level,
      country: company.country,
      city: company.city,
      foundedYear: company.foundedYear,
      annualRevenue: company.annualRevenue,
      employees: company.employees,
      parentCompany: raw[index].parentCompany ?? null,
    }));
    return { items, total, page: currentPage, pageSize: currentPageSize };
  }

  async searchForAgent(filters: {
    name?: string;
    country?: string;
    city?: string;
    levels?: number[];
    limit?: number;
    page?: number;
    pageSize?: number;
    sortBy?: 'companyName' | 'level' | 'country' | 'city' | 'foundedYear' | 'annualRevenue' | 'employees' | 'efficiency';
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const query = this.companiesRepository.createQueryBuilder('company');
    if (filters.name) query.andWhere('company.companyName ILIKE :name', { name: `%${filters.name}%` });
    if (filters.country) query.andWhere('company.country ILIKE :country', { country: `%${normalizeCountry(filters.country)}%` });
    if (filters.city) query.andWhere('company.city ILIKE :city', { city: `%${filters.city}%` });
    if (filters.levels?.length) query.andWhere('company.level IN (:...levels)', { levels: filters.levels });
    const page = Number.isInteger(filters.page) && filters.page! > 0 ? filters.page! : 1;
    const requestedPageSize = filters.pageSize ?? filters.limit ?? 5;
    const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, 100) : 5;
    const sortColumns = {
      companyName: 'company.companyName',
      level: 'company.level',
      country: 'company.country',
      city: 'company.city',
      foundedYear: 'company.foundedYear',
      annualRevenue: 'company.annualRevenue',
      employees: 'company.employees',
      efficiency: 'company.annualRevenue / NULLIF(company.employees, 0)',
    } as const;
    const sortBy = filters.sortBy ?? 'level';
    const sortOrder = filters.sortOrder ?? 'ASC';
    const [items, total] = await query
      .orderBy(sortColumns[sortBy], sortOrder)
      .addOrderBy('company.companyCode', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOneByCodeOrExactName(identifier: string) {
    return this.companiesRepository.createQueryBuilder('company')
      .where('LOWER(company.companyCode) = LOWER(:identifier)', { identifier })
      .orWhere('LOWER(company.companyName) = LOWER(:identifier)', { identifier })
      .getOne();
  }

  async create(dto: CreateCompanyDto) {
    const companyCode = dto.companyCode.trim();
    if (await this.companiesRepository.existsBy({ companyCode })) throw new ConflictException('Company code already exists');
    const company = await this.companiesRepository.save(this.companiesRepository.create({
      companyCode, companyName: dto.companyName.trim(), level: dto.level, country: dto.country.trim(), city: dto.city.trim(),
      foundedYear: dto.foundedYear, annualRevenue: dto.annualRevenue, employees: dto.employees,
    }));
    await this.relationshipsRepository.save({ companyCode, parentCompany: dto.parentCompany?.trim() || null });
    await this.queryCache?.invalidate('COMPANIES');
    return company;
  }

  async update(companyCode: string, dto: UpdateCompanyDto) {
    const company = await this.companiesRepository.findOneBy({ companyCode });
    if (!company) throw new NotFoundException('Company not found');
    const { parentCompany, companyCode: _companyCode, ...companyUpdates } = dto;
    Object.assign(company, companyUpdates);
    const saved = await this.companiesRepository.save(company);
    if (parentCompany !== undefined) await this.relationshipsRepository.upsert({ companyCode, parentCompany: parentCompany?.trim() || null }, ['companyCode']);
    await this.queryCache?.invalidate('COMPANIES');
    return saved;
  }

  async remove(companyCode: string) {
    const result = await this.companiesRepository.delete(companyCode);
    if (!result.affected) throw new NotFoundException('Company not found');
    await this.relationshipsRepository.delete({ companyCode });
    await this.queryCache?.invalidate('COMPANIES');
    return { deleted: true };
  }
}
