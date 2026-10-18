import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/company.entity.js';

@Injectable()
export class DashboardService {
  constructor(@InjectRepository(Company) private readonly companiesRepository: Repository<Company>) {}

  async getSummary() {
    const summary = await this.companiesRepository.createQueryBuilder('company')
      .select('COUNT(company.companyCode)', 'companyCount')
      .addSelect('COALESCE(SUM(company.annualRevenue), 0)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT company.country)', 'countryCount')
      .addSelect('COALESCE(SUM(company.employees), 0)', 'employeeCount')
      .getRawOne<{ companyCount: string; totalRevenue: string; countryCount: string; employeeCount: string }>();

    return {
      companyCount: Number(summary?.companyCount ?? 0),
      totalRevenue: Number(summary?.totalRevenue ?? 0),
      countryCount: Number(summary?.countryCount ?? 0),
      employeeCount: Number(summary?.employeeCount ?? 0),
    };
  }

  async getLevelDistribution() {
    const rows = await this.companiesRepository.createQueryBuilder('company')
      .select('company.level', 'level')
      .addSelect('COUNT(company.companyCode)', 'companyCount')
      .groupBy('company.level')
      .orderBy('company.level', 'ASC')
      .getRawMany<{ level: string; companyCount: string }>();

    const totalCompanies = rows.reduce((total, row) => total + Number(row.companyCount), 0);

    return {
      totalCompanies,
      levels: rows.map((row) => {
        const companyCount = Number(row.companyCount);
        return {
          level: Number(row.level),
          companyCount,
          percentage: totalCompanies === 0 ? 0 : Number(((companyCount / totalCompanies) * 100).toFixed(2)),
        };
      }),
    };
  }

  async getFoundedYearTrend() {
    const rows = await this.companiesRepository.createQueryBuilder('company')
      .select('company.foundedYear', 'year')
      .addSelect('COUNT(company.companyCode)', 'newCompanies')
      .groupBy('company.foundedYear')
      .orderBy('company.foundedYear', 'ASC')
      .getRawMany<{ year: string; newCompanies: string }>();

    if (rows.length === 0) {
      return { years: [] };
    }

    const companiesByYear = new Map(
      rows.map((row) => [Number(row.year), Number(row.newCompanies)]),
    );
    const firstYear = Number(rows[0].year);
    const lastYear = Number(rows[rows.length - 1].year);
    let cumulativeCompanies = 0;
    const years = [];

    for (let year = firstYear; year <= lastYear; year += 1) {
      const newCompanies = companiesByYear.get(year) ?? 0;
      cumulativeCompanies += newCompanies;
      years.push({ year, newCompanies, cumulativeCompanies });
    }

    return { years };
  }
}
