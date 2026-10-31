"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AddCommentOutlined, AttachFileOutlined, AutoAwesomeOutlined, Close, DeleteOutline, SendRounded } from '@mui/icons-material';
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, Drawer, Fab, IconButton, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { AiProvider, ChatAttachment, ChatMessage, ChatSession } from '@/lib/ai-agent';
import { aiFetch, apiBaseUrl, readApiError } from '@/lib/ai-agent';
import { AgentMessageRenderer } from './AgentMessageRenderer';

const SESSION_KEY = 'internship-admin-ai-session';
const MAX_FILE_BYTES = 2_000_000;
const MAX_TEXT_BYTES = 100_000;
const textFilePattern = /\.(txt|md|csv|json|tsv|log)$/i;
type SessionSummary = Omit<ChatSession, 'messages'>;
const summary = (session: ChatSession): SessionSummary => ({ id: session.id, title: session.title, provider: session.provider, model: session.model, createdAt: session.createdAt, updatedAt: session.updatedAt });

export function AgentChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [provider, setProvider] = useState<AiProvider['id']>('mock');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadSession(id: string) {
    const response = await aiFetch(`${apiBaseUrl}/ai-agent/sessions/${id}`);
    if (!response.ok) throw new Error(await readApiError(response));
    const loaded = await response.json() as ChatSession;
    setSession(loaded); setProvider(loaded.provider ?? 'mock');
    window.localStorage.setItem(SESSION_KEY, loaded.id);
  }
  async function createSession(selected: AiProvider['id']) {
    const response = await aiFetch(`${apiBaseUrl}/ai-agent/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: selected }) });
    if (!response.ok) throw new Error(await readApiError(response));
    const created = await response.json() as ChatSession;
    setSession(created); setProvider(selected); setSessions((items) => [summary(created), ...items.filter((item) => item.id !== created.id)]);
    window.localStorage.setItem(SESSION_KEY, created.id);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [providerRes, sessionRes] = await Promise.all([aiFetch(`${apiBaseUrl}/ai-agent/providers`), aiFetch(`${apiBaseUrl}/ai-agent/sessions`)]);
        if (!providerRes.ok) throw new Error(await readApiError(providerRes));
        if (!sessionRes.ok) throw new Error(await readApiError(sessionRes));
        const providerList = await providerRes.json() as AiProvider[];
        const sessionPage = await sessionRes.json() as { items: SessionSummary[] };
        const sessionList = sessionPage.items;
        if (cancelled) return;
        setProviders(providerList); setSessions(sessionList);
        const saved = window.localStorage.getItem(SESSION_KEY);
        const target = sessionList.find((item) => item.id === saved) ?? sessionList[0];
        if (target) await loadSession(target.id);
        else await createSession(providerList.find((item) => item.configured)?.id ?? 'mock');
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load chat history'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // Load saved history whenever the drawer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.messages.length, sending]);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []); event.target.value = '';
    const next: ChatAttachment[] = [];
    for (const file of selected.slice(0, Math.max(0, 5 - attachments.length))) {
      if (file.size > MAX_FILE_BYTES) { setNotice(`${file.name} exceeds 2 MB and was skipped.`); continue; }
      const item: ChatAttachment = { name: file.name, type: file.type || 'application/octet-stream', size: file.size };
      if ((file.type.startsWith('text/') || textFilePattern.test(file.name)) && file.size <= MAX_TEXT_BYTES) item.textContent = await file.text();
      else setNotice(`${file.name} is attached by name only. Text content support: TXT, MD, CSV, JSON, TSV, LOG (up to 100 KB).`);
      next.push(item);
    }
    setAttachments((current) => [...current, ...next].slice(0, 5));
  }
  async function deleteCurrentSession() {
    if (!session || !window.confirm(`Delete chat “${session.title}”? This cannot be undone.`)) return;
    setError('');
    try {
      const response = await aiFetch(`${apiBaseUrl}/ai-agent/sessions/${session.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
      const remaining = sessions.filter((item) => item.id !== session.id);
      setSessions(remaining);
      window.localStorage.removeItem(SESSION_KEY);
      setSession(null);
      if (remaining[0]) await loadSession(remaining[0].id);
      else await createSession(provider);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete chat'); }
  }
  async function handleSend() {
    if (sending || (!input.trim() && !attachments.length)) return;
    setSending(true); setError(''); setNotice('');
    const content = input.trim(); const files = attachments; setInput(''); setAttachments([]);
    try {
      let active = session;
      if (!active) { await createSession(provider); const res = await aiFetch(`${apiBaseUrl}/ai-agent/sessions`); if (!res.ok) throw new Error(await readApiError(res)); const page = await res.json() as { items: SessionSummary[] }; const list = page.items; if (!list[0]) throw new Error('Could not create chat session'); const detail = await aiFetch(`${apiBaseUrl}/ai-agent/sessions/${list[0].id}`); if (!detail.ok) throw new Error(await readApiError(detail)); active = await detail.json() as ChatSession; }
      const response = await aiFetch(`${apiBaseUrl}/ai-agent/sessions/${active.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, attachments: files }) });
      if (!response.ok) throw new Error(await readApiError(response));
      const updated = await response.json() as ChatSession;
      setSession(updated); setSessions((items) => [summary(updated), ...items.filter((item) => item.id !== updated.id)]); window.localStorage.setItem(SESSION_KEY, updated.id);
    } catch (cause) { setInput(content); setAttachments(files); setError(cause instanceof Error ? cause.message : 'Could not send message'); }
    finally { setSending(false); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }

  return <>
    <Tooltip title="Open AI assistant"><Fab color="primary" aria-label="Open AI assistant" onClick={() => setOpen(true)} sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1200 }}><AutoAwesomeOutlined /></Fab></Tooltip>
    <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, maxWidth: '100vw', display: 'flex' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34 }}><AutoAwesomeOutlined fontSize="small" /></Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700}>AI Assistant</Typography><Typography variant="caption" color="text.secondary" noWrap>{session?.model ?? 'Chat and task helper'}</Typography></Box>
        <Select size="small" value={provider} onChange={(event) => { const next = event.target.value as AiProvider['id']; setProvider(next); void createSession(next).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not create chat session')); }} sx={{ maxWidth: 150 }} aria-label="AI provider">
          {providers.map((item) => <MenuItem key={item.id} value={item.id} disabled={!item.configured}>{item.label}{item.configured ? '' : ' (not configured)'}</MenuItem>)}
        </Select>
        <Tooltip title="New chat"><IconButton onClick={() => void createSession(provider)} aria-label="New chat"><AddCommentOutlined /></IconButton></Tooltip>
        <Tooltip title="Delete current chat"><span><IconButton onClick={() => void deleteCurrentSession()} aria-label="Delete current chat" disabled={!session || sending}><DeleteOutline /></IconButton></span></Tooltip>
        <IconButton onClick={() => setOpen(false)} aria-label="Close chat"><Close /></IconButton>
      </Box>
      <Divider />
      {sessions.length > 0 && <Box sx={{ px: 2, py: 1 }}><Select fullWidth size="small" value={session?.id ?? ''} onChange={(event) => void loadSession(event.target.value)}>{sessions.map((item) => <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>)}</Select></Box>}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 1.5, bgcolor: 'grey.50' }}>
        {loading && <Stack alignItems="center" sx={{ mt: 8 }}><CircularProgress size={28} /><Typography sx={{ mt: 1 }}>Loading saved chats…</Typography></Stack>}
        {!loading && session?.messages.map((message: ChatMessage) => <Box key={message.id} sx={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}><Paper elevation={0} sx={{ maxWidth: '88%', p: 1.25, borderRadius: 2, bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary', border: message.role === 'assistant' ? 1 : 0, borderColor: 'divider' }}>
          {message.role === 'assistant' ? <AgentMessageRenderer message={message.structured} content={message.content} /> : <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content}</Typography>}
          {!!message.attachments?.length && <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>{message.attachments.map((file) => <Chip key={`${message.id}-${file.name}`} size="small" icon={<AttachFileOutlined />} label={file.name} />)}</Stack>}
        </Paper></Box>)}
        {sending && <Stack direction="row" gap={1} alignItems="center"><CircularProgress size={14} /><Typography variant="body2">Assistant is responding…</Typography></Stack>}<div ref={endRef} />
      </Box>
      <Divider /><Box sx={{ p: 1.5 }}>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}{notice && <Alert severity="info" onClose={() => setNotice('')} sx={{ mb: 1 }}>{notice}</Alert>}
        {!!attachments.length && <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>{attachments.map((file) => <Chip key={file.name} size="small" icon={<AttachFileOutlined />} label={file.name} onDelete={() => setAttachments((items) => items.filter((item) => item !== file))} />)}</Stack>}
        <Stack direction="row" alignItems="flex-end" gap={0.75}><input ref={fileRef} hidden type="file" multiple onChange={(event) => void handleFiles(event)} /><Tooltip title="Attach files"><IconButton aria-label="Attach files" onClick={() => fileRef.current?.click()}><AttachFileOutlined /></IconButton></Tooltip>
          <TextField fullWidth multiline minRows={1} maxRows={5} size="small" placeholder="Type a message (Enter to send, Shift+Enter for newline)" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} />
          <Button variant="contained" aria-label="Send message" onClick={() => void handleSend()} disabled={sending || (!input.trim() && !attachments.length)} sx={{ minWidth: 44, px: 1.25, height: 40 }}><SendRounded fontSize="small" /></Button>
        </Stack><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>Demo mode works without a key. Text attachments up to 100 KB are included in the conversation.</Typography>
      </Box>
    </Drawer>
  </>;
}
