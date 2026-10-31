"use client";

import { useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import type { StructuredMessage } from '@/lib/ai-agent';

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

  const flushList = () => {
    if (listLines.length) {
      blocks.push(<Box component="ul" key={`list-${blocks.length}`} sx={{ pl: 2.5, my: 0.5 }}>{listLines.map((line, index) => <li key={index}>{inlineMarkdown(line.replace(/^(?:[-*]|\d+\.)\s+/, ''))}</li>)}</Box>);
      listLines = [];
    }
  };

  lines.forEach((line, index) => {
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
  return <Box sx={{ display: 'grid', gap: 0.4 }}>{blocks}</Box>;
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

export function AgentMessageRenderer({ message, content }: { message: StructuredMessage | undefined; content: string }) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  if (!message || message.type === 'text') return <MarkdownText text={message?.type === 'text' ? message.text : content} />;
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
