import { describe, expect, it } from 'vitest';
import { normalizeCountry } from './normalize-country.js';
import { CompaniesService } from './companies.service.js';

describe('country aliases in company searches', () => {
  it.each(['日本', 'Japan', ' japan ', 'JP', 'jpn'])('uses the same database country for %s', async (country) => {
    const conditions: unknown[] = [];
    const qb: any = {};
    for (const method of ['orderBy', 'addOrderBy', 'skip', 'take']) qb[method] = () => qb;
    qb.andWhere = (sql: string, params: unknown) => { conditions.push([sql, params]); return qb; };
    qb.getManyAndCount = async () => [[], 0];
    const service = new CompaniesService({ createQueryBuilder: () => qb } as never, {} as never);
    await service.searchForAgent({ country, levels: [2] });
    expect(conditions).toContainEqual(['company.country ILIKE :country', { country: '%Japan%' }]);
    expect(conditions).toContainEqual(['company.level IN (:...levels)', { levels: [2] }]);
  });
  it.each(['美国', 'USA', 'United States', 'U.S.A.'])('normalizes %s to USA', (country) => {
    expect(normalizeCountry(country)).toBe('USA');
  });
  it('preserves unknown country filters instead of removing them', () => {
    expect(normalizeCountry(' Unknown country ')).toBe('Unknown country');
  });
});
