/** Normalize explicit country aliases; unknown names stay filters, never widen a query. */
export function normalizeCountry(value: string): string {
  const cleaned = value.trim();
  const key = cleaned.toLowerCase().replace(/[.\s_-]+/g, '');
  const aliases: Record<string, string> = {
    '日本': 'Japan', japan: 'Japan', jp: 'Japan', jpn: 'Japan',
    '美国': 'USA', '美國': 'USA', usa: 'USA', us: 'USA', unitedstates: 'USA', unitedstatesofamerica: 'USA',
    '中国': 'China', '中國': 'China', china: 'China', cn: 'China', chn: 'China',
    '英国': 'UK', '英國': 'UK', uk: 'UK', unitedkingdom: 'UK', gb: 'UK', gbr: 'UK',
    '德国': 'Germany', '德國': 'Germany', germany: 'Germany', de: 'Germany',
    '法国': 'France', '法國': 'France', france: 'France', fr: 'France',
    '加拿大': 'Canada', canada: 'Canada', ca: 'Canada',
    '澳大利亚': 'Australia', '澳洲': 'Australia', australia: 'Australia', au: 'Australia',
    '印度': 'India', india: 'India', '韩国': 'South Korea', '韓國': 'South Korea', southkorea: 'South Korea',
  };
  return aliases[key] ?? cleaned;
}
