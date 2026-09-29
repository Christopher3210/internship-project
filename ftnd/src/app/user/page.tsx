"use client";

import { DashboardShell } from "@/components/DashboardShell";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useCallback, useEffect, useState } from "react";

type User = { id: string; name: string; email: string; createdAt: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const loadUsers = useCallback(async (query: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/users?name=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error();
      const data: User[] = await response.json();
      setUsers(data);
      setSelectedIds([]);
    } catch {
      setNotice({ severity: "error", text: "无法加载用户，请确认后端服务已启动。" });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadUsers(nameQuery), 250);
    return () => window.clearTimeout(timer);
  }, [nameQuery, loadUsers]);

  function toggleUser(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds(selectedIds.length === users.length ? [] : users.map((user) => user.id));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiBaseUrl}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: { message?: string | string[] } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message);
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "" });
      setNotice({ severity: "success", text: "用户已添加。" });
      await loadUsers(nameQuery);
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error && error.message ? error.message : "添加用户失败。" });
    }
  }

  async function handleDelete() {
    if (!selectedIds.length) return;
    try {
      const response = await fetch(`${apiBaseUrl}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok) throw new Error();
      setNotice({ severity: "success", text: `已删除 ${selectedIds.length} 名用户。` });
      await loadUsers(nameQuery);
    } catch {
      setNotice({ severity: "error", text: "删除失败，请稍后重试。" });
    }
  }

  return <DashboardShell title="User">
    <Stack spacing={3}>
      <Typography color="text.secondary">按姓名搜索、添加用户，或勾选多名用户后批量删除。</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between">
        <TextField
          label="按姓名搜索"
          value={nameQuery}
          onChange={(event) => setNameQuery(event.target.value)}
          sx={{ width: { xs: "100%", sm: 360 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineOutlined />} disabled={!selectedIds.length} onClick={handleDelete}>
            删除已选 ({selectedIds.length})
          </Button>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialogOpen(true)}>添加 User</Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead><TableRow>
            <TableCell padding="checkbox"><Checkbox checked={users.length > 0 && selectedIds.length === users.length} indeterminate={selectedIds.length > 0 && selectedIds.length < users.length} onChange={toggleAll} /></TableCell>
            <TableCell>姓名</TableCell><TableCell>邮箱</TableCell><TableCell>创建时间</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {users.map((user) => <TableRow hover key={user.id} selected={selectedIds.includes(user.id)}>
              <TableCell padding="checkbox"><Checkbox checked={selectedIds.includes(user.id)} onChange={() => toggleUser(user.id)} /></TableCell>
              <TableCell>{user.name || "—"}</TableCell><TableCell>{user.email}</TableCell><TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>)}
            {!users.length && <TableRow><TableCell colSpan={4} align="center">没有找到用户</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>

    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleCreate}>
        <DialogTitle>添加 User</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="姓名" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="电子邮箱" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <TextField label="密码" type="password" required inputProps={{ minLength: 8 }} helperText="至少 8 个字符" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setDialogOpen(false)}>取消</Button><Button type="submit" variant="contained">添加</Button></DialogActions>
      </Box>
    </Dialog>

    <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.severity} variant="filled">{notice.text}</Alert> : undefined}</Snackbar>
  </DashboardShell>;
}
