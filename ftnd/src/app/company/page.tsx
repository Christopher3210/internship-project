"use client";

import { DashboardShell } from "@/components/DashboardShell";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Snackbar,
  Alert,
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
import { useCallback, useEffect, useState } from "react";

type Company = {
  companyCode: string;
  companyName: string;
  level: number;
  country: string;
  city: string;
  foundedYear: number;
  annualRevenue: number;
  employees: number;
  parentCompany?: string | null;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const companyLevels = [1, 2, 3, 4];

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCompanies = useCallback(async (query: string, selectedLevels: number[]) => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("name", query.trim());
      if (selectedLevels.length) params.set("levels", selectedLevels.join(","));
      const response = await fetch(`${apiBaseUrl}/companies?${params.toString()}`);
      if (!response.ok) throw new Error();
      setCompanies(await response.json());
    } catch {
      setNotice("无法加载公司数据，请确认后端服务已启动。");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadCompanies(nameQuery, levels), 250);
    return () => window.clearTimeout(timer);
  }, [nameQuery, levels, loadCompanies]);

  return <DashboardShell title="Company">
    <Stack spacing={3}>
      <Typography color="text.secondary">Company 字段与老师提供的 companies dummy data 保持一致。</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <TextField
          label="按公司名搜索"
          value={nameQuery}
          onChange={(event) => setNameQuery(event.target.value)}
          sx={{ width: { xs: "100%", md: 380 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
        />
        <FormControl sx={{ minWidth: 280 }}>
          <InputLabel id="level-filter-label">按 Level 多选过滤</InputLabel>
          <Select
            labelId="level-filter-label"
            multiple
            value={levels}
            onChange={(event) => setLevels(typeof event.target.value === "string" ? event.target.value.split(",").map(Number) : event.target.value)}
            input={<OutlinedInput label="按 Level 多选过滤" />}
            renderValue={(selected) => <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{selected.map((level) => <Chip key={level} label={`Level ${level}`} size="small" />)}</Box>}
          >
            {companyLevels.map((level) => <MenuItem key={level} value={level}><Checkbox checked={levels.includes(level)} /><ListItemText primary={`Level ${level}`} /></MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small"><TableHead><TableRow>
          <TableCell>Code</TableCell><TableCell>Company Name</TableCell><TableCell>Level</TableCell><TableCell>Country / City</TableCell><TableCell>Founded</TableCell><TableCell align="right">Revenue</TableCell><TableCell align="right">Employees</TableCell><TableCell>Parent</TableCell>
        </TableRow></TableHead><TableBody>
          {companies.map((company) => <TableRow hover key={company.companyCode}>
            <TableCell>{company.companyCode}</TableCell><TableCell>{company.companyName}</TableCell><TableCell><Chip label={`Level ${company.level}`} size="small" /></TableCell><TableCell>{company.country} / {company.city}</TableCell><TableCell>{company.foundedYear}</TableCell><TableCell align="right">{company.annualRevenue.toLocaleString()}</TableCell><TableCell align="right">{company.employees.toLocaleString()}</TableCell><TableCell>{company.parentCompany ?? "—"}</TableCell>
          </TableRow>)}
          {!companies.length && <TableRow><TableCell colSpan={8} align="center">没有找到公司</TableCell></TableRow>}
        </TableBody></Table>
      </TableContainer>
    </Stack>
    <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}><Alert severity="error" variant="filled">{notice}</Alert></Snackbar>
  </DashboardShell>;
}
