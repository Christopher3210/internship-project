"use client";

import { Chip, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { DashboardShell } from '@/components/DashboardShell';

const tasks = [
  { id: 'AG-001', name: 'Supplier risk review', status: 'In progress', progress: 65, updated: '2026-10-24 09:20' },
  { id: 'AG-002', name: 'Company profile summary', status: 'Completed', progress: 100, updated: '2026-10-24 08:45' },
  { id: 'AG-003', name: 'Order anomaly check', status: 'Queued', progress: 0, updated: '2026-10-23 17:10' },
];

export default function AgentTasksPage() {
  return <DashboardShell title="Agent Tasks">
    <Typography color="text.secondary" sx={{ mb: 3 }}>Demo task history for the AI agent workflow.</Typography>
    <TableContainer component={Paper} variant="outlined"><Table>
      <TableHead><TableRow><TableCell>Task</TableCell><TableCell>Status</TableCell><TableCell sx={{ minWidth: 180 }}>Progress</TableCell><TableCell>Last updated</TableCell></TableRow></TableHead>
      <TableBody>{tasks.map((task) => <TableRow key={task.id} hover>
        <TableCell><Typography fontWeight={600}>{task.name}</Typography><Typography variant="caption" color="text.secondary">{task.id}</Typography></TableCell>
        <TableCell><Chip size="small" label={task.status} color={task.status === 'Completed' ? 'success' : task.status === 'In progress' ? 'primary' : 'default'} /></TableCell>
        <TableCell><Typography variant="caption">{task.progress}%</Typography><LinearProgress variant="determinate" value={task.progress} sx={{ mt: 0.5, borderRadius: 1 }} /></TableCell>
        <TableCell>{task.updated}</TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer>
  </DashboardShell>;
}
