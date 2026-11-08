"use client";

import { Fragment, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import type { StructuredMessage } from '@/lib/ai-agent';
import type { ToolResult } from '@/lib/ai-agent';
import { aiFetch, apiBaseUrl, readApiError } from '@/lib/ai-agent';
import { Chart as ChartJS, ArcElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip as ChartTooltip } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, ChartTooltip);

type DataRecord = Record<string, unknown>;
const record = (value: unknown): DataRecord => typeof value === 'object' && value !== null ? value as DataRecord : {};
const array = (value: unknown): DataRecord[] => Array.isArray(value) ? value.map(record) : [];
const number = (value: unknown) => Number(value ?? 0);
const displayNumber = (value: unknown) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(number(value));

function ToolTable({ result: initialResult, pageUrl }: { result: ToolResult; pageUrl?: string }) {
  const [result, setResult] = useState(initialResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const data = record(result.data);
  const page = number(data.page) || 1;
  const totalPages = number(data.totalPages) || 1;
  const canPage = !!pageUrl && !!initialResult.input && ['search_companies_table', 'search_users'].includes(initialResult.toolName ?? '');
  async function changePage(next: number) {
    if (busy || !canPage) return;
    setBusy(true); setError('');
    try {
      const response = await aiFetch(`${pageUrl}?page=${next}`);
      if (!response.ok) throw new Error(await readApiError(response));
      const updated = await response.json() as ToolResult;
      if (updated.code >= 400) throw new Error(updated.message);
      setResult(updated); setExpanded(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load page'); }
    finally { setBusy(false); }
  }
  const items = array(data.items);
  const companyRows = items.some((item) => 'profitabilityEfficiency' in item);
  const columns = companyRows
    ? ['Company', 'Level', 'Country', 'Revenue / employee']
    : items.some((item) => 'email' in item) ? ['Name', 'Email', 'Title / role', 'Status'] : Object.keys(items[0] ?? {}).filter((key) => key !== 'details');
  const [expanded, setExpanded] = useState<string | null>(null);
  return <Box>
    {totalPages > 1 && <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Button variant="outlined" size="small" disabled={busy || !canPage || page <= 1} onClick={() => void changePage(page - 1)}>上一页</Button>
      <Typography variant="caption">第 {page} / {totalPages} 页 · 共 {number(data.total)} 条</Typography>
      <Button variant="outlined" size="small" disabled={busy || !canPage || page >= totalPages} onClick={() => void changePage(page + 1)}>{busy ? '加载中…' : '下一页'}</Button>
    </Stack>}
    {totalPages > 1 && !canPage && <Alert severity="info">这是旧查询记录，请重新查询以启用翻页。</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <Typography variant="caption" color="text.secondary">{result.message}{number(data.total) > 0 ? ` · 第 ${page} / ${totalPages} 页` : ''}</Typography>
    {items.length === 0 && <Alert severity="info">没有符合当前筛选条件的记录。</Alert>}
    <Paper variant="outlined" sx={{ mt: 0.5, overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{companyRows && <TableCell />}{columns.map((column) => <TableCell key={column}>{column}</TableCell>)}</TableRow></TableHead>
      <TableBody>{items.map((item, index) => {
        const key = String(item.companyCode ?? item.id ?? index);
        const details = record(item.details);
        return <Fragment key={key}>
          <TableRow key={key} hover>{companyRows && <TableCell><Button size="small" onClick={() => setExpanded(expanded === key ? null : key)}>{expanded === key ? 'Hide' : 'Details'}</Button></TableCell>}
            {companyRows ? <><TableCell>{String(item.companyName ?? '')}</TableCell><TableCell>{String(item.level ?? '')}</TableCell><TableCell>{String(item.country ?? '')}</TableCell><TableCell sx={{ bgcolor: `rgba(46, 125, 50, ${number(item.efficiencyBackgroundAlpha)})` }}>{displayNumber(item.profitabilityEfficiency)}</TableCell></>
              : 'email' in item ? <><TableCell>{String(item.name ?? '')}</TableCell><TableCell>{String(item.email ?? '')}</TableCell><TableCell>{String(item.title ?? item.role ?? '')}</TableCell><TableCell>{String(item.status ?? '')}</TableCell></>
                : columns.map((column) => <TableCell key={column}>{String(item[column] ?? '')}</TableCell>)}</TableRow>
          {companyRows && expanded === key && <TableRow key={`${key}-details`}><TableCell colSpan={columns.length + 1}><Stack direction="row" gap={2} flexWrap="wrap">{[['City', details.city], ['Founded', details.foundedYear], ['Annual revenue', details.annualRevenue], ['Employees', details.employees]].map(([label, value]) => <Typography key={String(label)} variant="caption">{String(label)}: {label === 'Annual revenue' || label === 'Employees' ? displayNumber(value) : String(value ?? '—')}</Typography>)}</Stack></TableCell></TableRow>}
        </Fragment>;
      })}</TableBody>
    </Table></Paper>
  </Box>;
}

function ToolReport({ result }: { result: ToolResult }) {
  const data = record(result.data);
  const summary = record(data.summary ?? data);
  const levels = array(data.levels);
  const years = array(data.years);
  const colors = ['#5be49b', '#00b8d9', '#7635dc', '#ffab00'];
  const levelChartData = { labels: levels.map((item) => `Level ${item.level}`), datasets: [{ data: levels.map((item) => number(item.companyCount)), backgroundColor: levels.map((_, index) => colors[index % colors.length]), borderWidth: 0 }] };
  const levelChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: { callbacks: { label: (context: { dataIndex: number; label: string }) => {
        const item = levels[context.dataIndex];
        return ` ${context.label}: ${number(item.companyCount).toLocaleString()} (${number(item.percentage).toFixed(1)}%)`;
      } } },
    },
  };
  const yearChartData = { labels: years.map((item) => String(item.year)), datasets: [{ label: 'Companies', data: years.map((item) => number(item.cumulativeCompanies)), borderColor: '#00a76f', backgroundColor: 'rgba(0,167,111,0.12)', fill: true, tension: 0.35 }] };
  const yearChartOptions = { responsive: true, interaction: { mode: 'index' as const, intersect: false }, plugins: { tooltip: { enabled: true } }, scales: { y: { beginAtZero: true } } };
  return <Stack spacing={1.25}>
    <Typography variant="caption" color="text.secondary">{result.message}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>{[['Companies', summary.companyCount], ['Revenue', summary.totalRevenue], ['Countries', summary.countryCount], ['Employees', summary.employeeCount]].map(([label, value]) => <Card key={String(label)} variant="outlined"><CardContent sx={{ p: '12px !important' }}><Typography variant="caption" color="text.secondary">{String(label)}</Typography><Typography variant="h6" fontWeight={700}>{displayNumber(value)}</Typography></CardContent></Card>)}</Box>
    {levels.length > 0 && <Card variant="outlined"><CardContent><Typography variant="subtitle2" fontWeight={700}>Supplier levels</Typography><Box sx={{ maxWidth: 270, mx: 'auto' }}><Doughnut data={levelChartData} options={levelChartOptions} /></Box></CardContent></Card>}
    {years.length > 0 && <Card variant="outlined"><CardContent><Typography variant="subtitle2" fontWeight={700}>Cumulative companies by founded year</Typography><Line data={yearChartData} options={yearChartOptions} /></CardContent></Card>}
  </Stack>;
}

function ToolResults({ results, sessionId, messageId }: { results: ToolResult[]; sessionId?: string; messageId?: string }) {
  return <Stack spacing={1} sx={{ mt: 1 }}>{results.map((result, index) => <Box key={`${result.resultType}-${index}`}>
    {result.code >= 400 ? <Alert severity="error">{result.message}</Alert>
      : result.resultType === 'table' ? <ToolTable result={result} pageUrl={sessionId && messageId ? `${apiBaseUrl}/ai-agent/sessions/${sessionId}/messages/${messageId}/results/${index}` : undefined} />
        : result.resultType === 'report' ? <ToolReport result={result} />
          : <Alert severity="info">{result.message}{typeof result.data === 'string' ? ` ${result.data}` : ''}</Alert>}
  </Box>)}</Stack>;
}

function inlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <Box key={index} component="code" sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: 'action.hover', fontFamily: 'monospace' }}>{part.slice(1, -1)}</Box>;
    return <span key={index}>{part}</span>;
  });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let codeLines: string[] = [];
  let inCode = false;
  let listLines: string[] = [];
  let consumedThrough = -1;
  const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));

  const flushList = () => {
    if (listLines.length) {
      blocks.push(<Box component="ul" key={`list-${blocks.length}`} sx={{ pl: 2.5, my: 0.5 }}>{listLines.map((line, index) => <li key={index}>{inlineMarkdown(line.replace(/^(?:[-*]|\d+\.)\s+/, ''))}</li>)}</Box>);
      listLines = [];
    }
  };

  lines.forEach((line, index) => {
    if (index <= consumedThrough) return;
    if (line.trim().startsWith('```')) {
      flushList();
      if (inCode) {
        blocks.push(<Box component="pre" key={`code-${index}`} sx={{ p: 1.25, my: 0.75, overflowX: 'auto', borderRadius: 1, bgcolor: 'grey.900', color: 'grey.100', fontSize: 12 }}><code>{codeLines.join('\n')}</code></Box>);
        codeLines = [];
      }
      inCode = !inCode;
      return;
    }
    if (inCode) { codeLines.push(line); return; }
    const headers = tableCells(line);
    const separator = tableCells(lines[index + 1] ?? '');
    if (headers.length > 1 && separator.length === headers.length && separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      flushList();
      const alignments = separator.map((cell): 'left' | 'center' | 'right' => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left');
      const rows: string[][] = [];
      let next = index + 2;
      while (next < lines.length && lines[next].trim() && lines[next].includes('|')) {
        const cells = tableCells(lines[next]);
        if (cells.length > headers.length) break;
        rows.push(headers.map((_, column) => cells[column] ?? ''));
        next += 1;
      }
      consumedThrough = next - 1;
      blocks.push(<Box key={`table-${index}`} sx={{ minWidth: 0, maxWidth: '100%', my: 1 }}>
        <Typography variant="caption" color="text.secondary">表格可左右滑动查看</Typography>
        <Paper variant="outlined" role="region" aria-label="回答中的数据表格" tabIndex={0} sx={{ width: '100%', overflowX: 'auto', mt: 0.5 }}>
          <Table size="small" sx={{ minWidth: Math.max(420, headers.length * 110), '& th, & td': { verticalAlign: 'top', px: 1.5, py: 1 }, '& th': { bgcolor: 'action.hover', fontWeight: 700, whiteSpace: 'nowrap' } }}>
            <TableHead><TableRow>{headers.map((header, column) => <TableCell key={column} align={alignments[column]}>{inlineMarkdown(header)}</TableCell>)}</TableRow></TableHead>
            <TableBody>{rows.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, column) => <TableCell key={column} align={alignments[column]} sx={{ minWidth: column === 0 ? 160 : 85 }}>{inlineMarkdown(cell)}</TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </Paper>
      </Box>);
      return;
    }
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) { listLines.push(line); return; }
    flushList();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const variant = heading[1].length === 1 ? 'h6' : heading[1].length === 2 ? 'subtitle1' : 'subtitle2';
      blocks.push(<Typography key={`heading-${index}`} variant={variant} fontWeight={700} sx={{ mt: 0.75 }}>{inlineMarkdown(heading[2])}</Typography>);
    } else if (line.trim()) {
      blocks.push(<Typography key={`p-${index}`} variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inlineMarkdown(line)}</Typography>);
    }
  });
  flushList();
  if (inCode && codeLines.length) blocks.push(<Box component="pre" key="code-final" sx={{ p: 1.25, overflowX: 'auto', borderRadius: 1, bgcolor: 'grey.900', color: 'grey.100', fontSize: 12 }}><code>{codeLines.join('\n')}</code></Box>);
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, maxWidth: '100%', gap: 0.4 }}>{blocks}</Box>;
}

function ChartCard({ message }: { message: Extract<StructuredMessage, { type: 'chart' }> }) {
  const max = Math.max(1, ...message.values);
  return <Card variant="outlined" sx={{ mt: 1 }}><CardContent>
    <Typography variant="subtitle2" fontWeight={700}>{message.title}</Typography>
    <Box sx={{ display: 'flex', alignItems: 'end', gap: 1, height: 130, mt: 2, borderBottom: 1, borderColor: 'divider' }}>
      {message.values.map((value, index) => <Box key={`${message.labels[index]}-${index}`} sx={{ flex: 1, display: 'grid', alignItems: 'end', height: '100%', textAlign: 'center' }}>
        <Typography variant="caption">{value}</Typography>
        <Box sx={{ width: '70%', mx: 'auto', minHeight: 2, height: `${Math.max(4, value / max * 82)}%`, bgcolor: 'primary.main', borderRadius: '4px 4px 0 0' }} />
        <Typography variant="caption" noWrap>{message.labels[index]}</Typography>
      </Box>)}
    </Box>
  </CardContent></Card>;
}

export function AgentMessageRenderer({ message, content, toolResults = [], sessionId, messageId }: { message: StructuredMessage | undefined; content: string; toolResults?: ToolResult[]; sessionId?: string; messageId?: string }) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  if (!message || message.type === 'text') return <><MarkdownText text={message?.type === 'text' ? message.text : content} />{!!toolResults.length && <ToolResults results={toolResults} sessionId={sessionId} messageId={messageId} />}</>;
  if (message.type === 'table') return <Box>
    {message.title && <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>{message.title}</Typography>}
    <Paper variant="outlined" sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{message.columns.map((column) => <TableCell key={column}>{column}</TableCell>)}</TableRow></TableHead>
      <TableBody>{message.rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</TableBody>
    </Table></Paper>
  </Box>;
  if (message.type === 'chart') return <ChartCard message={message} />;
  if (message.type === 'report') return <Card variant="outlined"><CardContent>
    <Typography variant="subtitle1" fontWeight={700}>{message.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{message.summary}</Typography>
    {message.sections.map((section, index) => <Box key={index} sx={{ mt: 1.5 }}><Typography variant="subtitle2" fontWeight={700}>{section.title}</Typography><Typography variant="body2">{section.content}</Typography></Box>)}
  </CardContent></Card>;
  return <>
    <Alert severity="warning" action={<Button size="small" onClick={() => setConfirmationOpen(true)}>{message.confirmLabel || '查看并确认'}</Button>}>{message.title}: {message.message}</Alert>
    <Dialog open={confirmationOpen} onClose={() => setConfirmationOpen(false)}>
      <DialogTitle>{message.title}</DialogTitle><DialogContent><Typography>{message.message}</Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmationOpen(false)}>取消</Button><Button variant="contained" onClick={() => setConfirmationOpen(false)}>{message.confirmLabel || '确认'}</Button></DialogActions>
    </Dialog>
  </>;
}
