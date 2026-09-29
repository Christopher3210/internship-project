"use client";

import { DashboardShell } from "@/components/DashboardShell";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputAdornment, InputLabel, MenuItem, Paper, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type User = { id: string; name: string; email: string; role: string; status: string };
type UserForm = { name: string; email: string; role: string; status: string; password: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const emptyForm: UserForm = { name: "", email: "", role: "Member", status: "Active", password: "" };

export default function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [knownRoles, setKnownRoles] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const loadUsers = useCallback(async (query: string, roles: string[]) => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("name", query.trim());
      if (roles.length) params.set("roles", roles.join(","));
      const response = await fetch(`${apiBaseUrl}/users?${params.toString()}`);
      if (!response.ok) throw new Error();
      const data: User[] = await response.json();
      setUsers(data);
      setKnownRoles((current) => Array.from(new Set([...current, ...data.map((user) => user.role)])).sort());
      setSelectedIds([]);
    } catch {
      setNotice({ severity: "error", text: "无法加载用户，请确认后端服务已启动。" });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadUsers(nameQuery, selectedRoles), 250);
    return () => window.clearTimeout(timer);
  }, [nameQuery, selectedRoles, loadUsers]);

  const allVisibleSelected = useMemo(() => users.length > 0 && users.every((user) => selectedIds.includes(user.id)), [users, selectedIds]);
  function toggleUser(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleAll() { setSelectedIds(allVisibleSelected ? [] : users.map((user) => user.id)); }
  function openCreateDialog() { setEditingUser(null); setForm(emptyForm); setDialogOpen(true); }
  function openEditDialog(user: User) { setEditingUser(user); setForm({ name: user.name, email: user.email, role: user.role, status: user.status, password: "" }); setDialogOpen(true); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = editingUser && !form.password ? { ...form, password: undefined } : form;
    try {
      const response = await fetch(editingUser ? `${apiBaseUrl}/users/${editingUser.id}` : `${apiBaseUrl}/users`, {
        method: editingUser ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data: { message?: string | string[] } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message);
      setDialogOpen(false);
      setNotice({ severity: "success", text: editingUser ? "用户已更新。" : "用户已添加。" });
      await loadUsers(nameQuery, selectedRoles);
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error && error.message ? error.message : "保存用户失败。" });
    }
  }

  async function deleteUsers(ids: string[]) {
    if (!ids.length) return;
    try {
      const response = await fetch(`${apiBaseUrl}/users`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error();
      setNotice({ severity: "success", text: `已删除 ${ids.length} 名用户。` });
      await loadUsers(nameQuery, selectedRoles);
    } catch { setNotice({ severity: "error", text: "删除失败，请稍后重试。" }); }
  }

  return <DashboardShell title="User"><Stack spacing={3}>
    <Typography color="text.secondary">按姓名搜索、按 Title / Role 多选筛选，并管理用户信息。</Typography>
    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField label="按姓名搜索" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} sx={{ width: { xs: "100%", sm: 300 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
        <FormControl sx={{ minWidth: { xs: "100%", sm: 260 } }}><InputLabel id="role-filter-label">Title / Role</InputLabel><Select labelId="role-filter-label" multiple value={selectedRoles} label="Title / Role" onChange={(event) => setSelectedRoles(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)} renderValue={(selected) => selected.join(", ")}>
          {knownRoles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
        </Select></FormControl>
      </Stack>
      <Stack direction="row" spacing={1}><Button variant="outlined" color="error" startIcon={<DeleteOutlineOutlined />} disabled={!selectedIds.length} onClick={() => deleteUsers(selectedIds)}>删除已选 ({selectedIds.length})</Button><Button variant="contained" startIcon={<AddOutlined />} onClick={openCreateDialog}>添加 User</Button></Stack>
    </Stack>
    <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow>
      <TableCell padding="checkbox"><Checkbox checked={allVisibleSelected} indeterminate={selectedIds.length > 0 && !allVisibleSelected} onChange={toggleAll} /></TableCell><TableCell>姓名</TableCell><TableCell>邮箱</TableCell><TableCell>Title / Role</TableCell><TableCell>Status</TableCell><TableCell align="right">操作</TableCell>
    </TableRow></TableHead><TableBody>
      {users.map((user) => <TableRow hover key={user.id} selected={selectedIds.includes(user.id)}><TableCell padding="checkbox"><Checkbox checked={selectedIds.includes(user.id)} onChange={() => toggleUser(user.id)} /></TableCell><TableCell>{user.name || "—"}</TableCell><TableCell>{user.email}</TableCell><TableCell>{user.role}</TableCell><TableCell><Box component="span" sx={{ color: user.status.toLowerCase() === "active" ? "success.main" : "text.secondary", fontWeight: 600 }}>{user.status}</Box></TableCell><TableCell align="right"><Tooltip title="编辑"><Button size="small" startIcon={<EditOutlined />} onClick={() => openEditDialog(user)}>编辑</Button></Tooltip><Tooltip title="删除"><Button size="small" color="error" startIcon={<DeleteOutlineOutlined />} onClick={() => deleteUsers([user.id])}>删除</Button></Tooltip></TableCell></TableRow>)}
      {!users.length && <TableRow><TableCell colSpan={6} align="center">没有找到用户</TableCell></TableRow>}
    </TableBody></Table></TableContainer>
  </Stack>
  <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs"><Box component="form" onSubmit={handleSubmit}><DialogTitle>{editingUser ? "编辑 User" : "添加 User"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
    <TextField label="姓名" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><TextField label="电子邮箱" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><TextField label="Title / Role" required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /><TextField select label="Status" required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><MenuItem value="Active">Active</MenuItem><MenuItem value="Inactive">Inactive</MenuItem><MenuItem value="Pending">Pending</MenuItem></TextField><TextField label={editingUser ? "新密码（留空则不修改）" : "密码"} type="password" required={!editingUser} inputProps={{ minLength: 8 }} helperText={editingUser ? "留空表示保留当前密码" : "至少 8 个字符"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
  </Stack></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)}>取消</Button><Button type="submit" variant="contained">保存</Button></DialogActions></Box></Dialog>
  <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.severity} variant="filled">{notice.text}</Alert> : undefined}</Snackbar>
  </DashboardShell>;
}
