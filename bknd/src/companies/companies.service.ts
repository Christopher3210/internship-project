import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

const demoCompanies: Omit<Company, 'createdAt' | 'updatedAt'>[] = [
  { companyCode: 'C0', companyName: 'Rodriguez, Figueroa and Sanchez', level: 1, country: 'China', city: 'Beijing', foundedYear: 1994, annualRevenue: 317736, employees: 4606, parentCompany: null },
  { companyCode: 'C01', companyName: 'Doyle Ltd', level: 2, country: 'Japan', city: 'Nagoya', foundedYear: 1917, annualRevenue: 429408, employees: 889, parentCompany: 'C0' },
  { companyCode: 'C02', companyName: 'Mcclain, Miller and Henderson', level: 2, country: 'China', city: 'Hangzhou', foundedYear: 1954, annualRevenue: 894345, employees: 310, parentCompany: 'C0' },
  { companyCode: 'C03', companyName: 'Davis and Sons', level: 2, country: 'USA', city: 'Los Angeles', foundedYear: 1927, annualRevenue: 391732, employees: 1955, parentCompany: 'C0' },
  { companyCode: 'C04', companyName: 'Guzman, Hoffman and Baldwin', level: 2, country: 'USA', city: 'Dallas', foundedYear: 1925, annualRevenue: 227886, employees: 4514, parentCompany: 'C0' },
  { companyCode: 'C05', companyName: 'Gardner, Robinson and Lawrence', level: 2, country: 'France', city: 'Toulouse', foundedYear: 1957, annualRevenue: 490037, employees: 4877, parentCompany: 'C0' },
  { companyCode: 'C06', companyName: 'Blake and Sons', level: 2, country: 'UK', city: 'London', foundedYear: 1997, annualRevenue: 535398, employees: 1357, parentCompany: 'C0' },
  { companyCode: 'C07', companyName: 'Henderson, Ramirez and Lewis', level: 2, country: 'France', city: 'Nantes', foundedYear: 1935, annualRevenue: 198265, employees: 1323, parentCompany: 'C0' },
  { companyCode: 'C001', companyName: 'Walker LLC', level: 3, country: 'Japan', city: 'Tokyo', foundedYear: 1994, annualRevenue: 94834, employees: 744, parentCompany: 'C01' },
  { companyCode: 'C002', companyName: 'Chapman and Sons', level: 3, country: 'USA', city: 'Houston', foundedYear: 1994, annualRevenue: 92538, employees: 947, parentCompany: 'C01' },
  { companyCode: 'C003', companyName: 'Robinson, Jones and Welch', level: 3, country: 'USA', city: 'Philadelphia', foundedYear: 1994, annualRevenue: 430915, employees: 546, parentCompany: 'C01' },
  { companyCode: 'C004', companyName: 'Jones Inc', level: 3, country: 'Japan', city: 'Sapporo', foundedYear: 2021, annualRevenue: 82422, employees: 239, parentCompany: 'C01' },
  { companyCode: 'C0302', companyName: 'Estrada-Nolan', level: 4, country: 'Germany', city: 'Düsseldorf', foundedYear: 2014, annualRevenue: 30690, employees: 194, parentCompany: 'C001' },
  { companyCode: 'C0303', companyName: 'Santana-Byrd', level: 4, country: 'France', city: 'Lille', foundedYear: 2023, annualRevenue: 95680, employees: 377, parentCompany: 'C001' },
  { companyCode: 'C0304', companyName: 'Jones LLC', level: 4, country: 'Germany', city: 'Düsseldorf', foundedYear: 2020, annualRevenue: 102619, employees: 55, parentCompany: 'C001' },
];

@Injectable()
export class CompaniesService implements OnModuleInit {
  constructor(@InjectRepository(Company) private readonly companiesRepository: Repository<Company>) {}

  async onModuleInit() {
    if (await this.companiesRepository.count()) return;
    await this.companiesRepository.save(demoCompanies);
  }

  findAll(name?: string, levels?: string) {
    const query = this.companiesRepository.createQueryBuilder('company');
    if (name?.trim()) {
      query.where('company.companyName ILIKE :name', { name: `%${name.trim()}%` });
    }

    const selectedLevels = (levels ?? '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 4);
    if (selectedLevels.length) {
      query.andWhere('company.level IN (:...levels)', { levels: selectedLevels });
    }

    return query.orderBy('company.level', 'ASC').addOrderBy('company.companyCode', 'ASC').getMany();
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const companyCode = createCompanyDto.companyCode.trim();
    if (await this.companiesRepository.existsBy({ companyCode })) {
      throw new ConflictException('Company code already exists');
    }
    return this.companiesRepository.save(this.companiesRepository.create({
      companyCode,
      companyName: createCompanyDto.companyName,
      level: createCompanyDto.level,
      country: createCompanyDto.country,
      city: createCompanyDto.city,
      foundedYear: createCompanyDto.foundedYear,
      annualRevenue: createCompanyDto.annualRevenue,
      employees: createCompanyDto.employees,
      parentCompany: createCompanyDto.parentCompany,
    }));
  }

  async update(companyCode: string, updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companiesRepository.findOneBy({ companyCode });
    if (!company) throw new NotFoundException('Company not found');
    Object.assign(company, updateCompanyDto);
    return this.companiesRepository.save(company);
  }

  async remove(companyCode: string) {
    const result = await this.companiesRepository.delete(companyCode);
    if (!result.affected) throw new NotFoundException('Company not found');
    return { deleted: true };
  }
}
