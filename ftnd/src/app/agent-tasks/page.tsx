"use client";

import { useCallback, useEffect, useState } from 'react';
import { Add, DeleteOutline, Refresh } from '@mui/icons-material';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, LinearProgress, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { DashboardShell } from '@/components/DashboardShell';
import { aiFetch, apiBaseUrl, readApiError } from '@/lib/ai-agent';

type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';
type AiTask = {
  id: string;
  taskType: string;
  status: TaskStatus;
  progress: number;
  input: Record<string, unknown>;
  result: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
type TaskPage = { items: AiTask[]; total: number };

const statusLabel: Record<TaskStatus, string> = {
  queued: 'Queued', running: 'In progress', completed: 'Completed', failed: 'Failed',
};
const statusColor: Record<TaskStatus, 'default' | 'primary' | 'success' | 'error'> = {
  queued: 'default', running: 'primary', completed: 'success', failed: 'error',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function readTaskSummary(result: unknown) {
  if (typeof result !== 'object' || result === null || !('summary' in result)) return null;
  return typeof result.summary === 'string' ? result.summary : null;
}

function progressDescription(task: AiTask) {
  if (task.status === 'queued') return 'Waiting to start';
  if (task.status === 'failed') return 'Task failed';
  if (task.status === 'completed') return 'Task finished';
  if (task.taskType === 'company_profile_summary') return task.progress < 60 ? 'Looking up company data' : 'Preparing the summary';
  return 'Task is running';
}

export default function AgentTasksPage() {
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskType, setTaskType] = useState('');
  const [description, setDescription] = useState('');

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await aiFetch(`${apiBaseUrl}/ai-agent/tasks?page=1&pageSize=100`);
      if (!response.ok) throw new Error(await readApiError(response));
      const page = await response.json() as TaskPage;
      setTasks(page.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load tasks');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
    const timer = window.setInterval(() => void loadTasks(true), 2000);
    return () => window.clearInterval(timer);
  }, [loadTasks]);

  async function createTask() {
    if (!taskType.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await aiFetch(`${apiBaseUrl}/ai-agent/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: taskType.trim(), input: description.trim() ? { description: description.trim() } : {} }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setTaskType('');
      setDescription('');
      setDialogOpen(false);
      await loadTasks();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create task');
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, patch: Partial<Pick<AiTask, 'status' | 'progress'>>) {
    setError('');
    try {
      const response = await aiFetch(`${apiBaseUrl}/ai-agent/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const updated = await response.json() as AiTask;
      setTasks((items) => items.map((item) => item.id === id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update task');
    }
  }

  async function deleteTask(task: AiTask) {
    if (!window.confirm(`Delete task “${task.taskType}”?`)) return;
    setError('');
    try {
      const response = await aiFetch(`${apiBaseUrl}/ai-agent/tasks/${task.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
      setTasks((items) => items.filter((item) => item.id !== task.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete task');
    }
  }

  return <DashboardShell title="Agent Tasks">
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ mb: 2 }}>
      <Typography color="text.secondary">Your saved AI task records and progress. Progress reflects completed processing stages, not elapsed time; short lookups may finish quickly.</Typography>
      <Stack direction="row" gap={1}>
        <Button startIcon={<Refresh />} onClick={() => void loadTasks()} disabled={loading}>Refresh</Button>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New task</Button>
      </Stack>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead><TableRow><TableCell>Task</TableCell><TableCell>Status</TableCell><TableCell sx={{ minWidth: 220 }}>Progress</TableCell><TableCell>Last updated</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={5}><Stack direction="row" alignItems="center" gap={1}><CircularProgress size={18} /><Typography>Loading tasks…</Typography></Stack></TableCell></TableRow>}
          {!loading && tasks.map((task) => <TableRow key={task.id} hover>
            <TableCell><Typography fontWeight={600}>{task.taskType}</Typography><Typography variant="caption" color="text.secondary">{task.id}</Typography>{typeof task.input.description === 'string' && <Typography variant="body2" color="text.secondary">{task.input.description}</Typography>}{task.error && <Typography variant="caption" color="error">{task.error}</Typography>}</TableCell>
            <TableCell>{task.taskType === 'company_profile_summary' ? <Chip size="small" label={statusLabel[task.status]} color={statusColor[task.status]} /> : <TextField select size="small" value={task.status} onChange={(event) => {
              const status = event.target.value as TaskStatus;
              const progress = status === 'completed' ? 100 : status === 'queued' ? 0 : task.progress;
              void updateTask(task.id, { status, progress });
            }} sx={{ minWidth: 140 }} inputProps={{ 'aria-label': `Status for ${task.taskType}` }}>
              {(Object.keys(statusLabel) as TaskStatus[]).map((status) => <MenuItem key={status} value={status}><Chip size="small" label={statusLabel[status]} color={statusColor[status]} /></MenuItem>)}
            </TextField>}</TableCell>
            <TableCell><Stack direction="row" alignItems="center" gap={1}><Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={task.progress} sx={{ borderRadius: 1 }} /></Box><Typography variant="caption" sx={{ minWidth: 34 }}>{task.progress}%</Typography></Stack><Typography variant="caption" color="text.secondary">{progressDescription(task)}</Typography>
              {task.status === 'running' && task.taskType !== 'company_profile_summary' && <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>{[25, 50, 75].filter((value) => value > task.progress).map((value) => <Button key={value} size="small" onClick={() => void updateTask(task.id, { progress: value })}>{value}%</Button>)}</Stack>}
            </TableCell>
            <TableCell>{formatDate(task.updatedAt)}{readTaskSummary(task.result) && <Typography variant="body2" sx={{ mt: 0.75, maxWidth: 360 }}>{readTaskSummary(task.result)}</Typography>}</TableCell>
            <TableCell align="right"><IconButton aria-label={`Delete ${task.taskType}`} onClick={() => void deleteTask(task)}><DeleteOutline /></IconButton></TableCell>
          </TableRow>)}
          {!loading && !tasks.length && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" sx={{ py: 2 }}>No saved tasks yet. Create one to start tracking its status.</Typography></TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
    <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Create an AI task record</DialogTitle>
      <DialogContent><Stack gap={2} sx={{ pt: 1 }}>
        <TextField autoFocus required label="Task name / type" value={taskType} onChange={(event) => setTaskType(event.target.value)} inputProps={{ maxLength: 100 }} />
        <TextField multiline minRows={3} label="Description (optional)" value={description} onChange={(event) => setDescription(event.target.value)} />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void createTask()} disabled={saving || !taskType.trim()}>{saving ? 'Saving…' : 'Create task'}</Button></DialogActions>
    </Dialog>
  </DashboardShell>;
}
