"use client";

import { DashboardShell } from "@/components/DashboardShell";
import KeyboardArrowDownOutlined from "@mui/icons-material/KeyboardArrowDownOutlined";
import KeyboardArrowUpOutlined from "@mui/icons-material/KeyboardArrowUpOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Alert, Box, Checkbox, Chip, Collapse, FormControl, IconButton, InputAdornment, InputLabel,
  ListItemText, MenuItem, OutlinedInput, Paper, Select, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

type Company = {
  companyCode: string; companyName: string; level: number; country: string; city: string;
  foundedYear: number; annualRevenue: number; employees: number;
};

type CompanyPage = {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const companyLevels = [1, 2, 3, 4];
const numberFormatter = new Intl.NumberFormat("en-US");

function efficiency(company: Company) { return company.employees ? company.annualRevenue / company.employees : 0; }

function CompanyRow({ company }: { company: Company }) {
  const [open, setOpen] = useState(false);
  const value = efficiency(company);
  // The data is between roughly 10 and 2,000; clamp it before converting it into a readable tint.
  const colorStrength = Math.min(0.24, 0.06 + (Math.min(value, 2000) / 2000) * 0.18);
  return <>
    <TableRow hover sx={{ "& > *": { borderBottom: open ? 0 : undefined } }}>
      <TableCell padding="checkbox"><IconButton aria-label="展开公司详情" size="small" onClick={() => setOpen(!open)}>{open ? <KeyboardArrowUpOutlined /> : <KeyboardArrowDownOutlined />}</IconButton></TableCell>
      <TableCell><Typography fontWeight={600}>{company.companyName}</Typography><Typography variant="caption" color="text.secondary">{company.companyCode}</Typography></TableCell>
      <TableCell><Chip label={`Level ${company.level}`} size="small" color={company.level === 1 ? "primary" : "default"} /></TableCell>
      <TableCell>{company.country}</TableCell>
      <TableCell><Box sx={{ display: "inline-block", px: 1.25, py: 0.5, borderRadius: 1, bgcolor: `rgba(46, 125, 50, ${colorStrength})`, fontWeight: 700 }}>{numberFormatter.format(Math.round(value))}</Box><Typography variant="caption" display="block" color="text.secondary">revenue / employee</Typography></TableCell>
    </TableRow>
    <TableRow><TableCell colSpan={5} sx={{ py: 0 }}><Collapse in={open} timeout="auto" unmountOnExit><Box sx={{ py: 2, px: 1 }}><Typography variant="subtitle2" gutterBottom>公司详情</Typography><Table size="small" aria-label={`${company.companyName} details`}><TableHead><TableRow><TableCell>城市</TableCell><TableCell>开始供应日期</TableCell><TableCell align="right">年盈利额</TableCell><TableCell align="right">员工数量</TableCell></TableRow></TableHead><TableBody><TableRow><TableCell>{company.city}</TableCell><TableCell>{company.foundedYear}</TableCell><TableCell align="right">{numberFormatter.format(company.annualRevenue)}</TableCell><TableCell align="right">{numberFormatter.format(company.employees)}</TableCell></TableRow></TableBody></Table></Box></Collapse></TableCell></TableRow>
  </>;
}

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCompanies = useCallback(async (query: string, selectedLevels: number[], currentPage: number, currentPageSize: number) => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("name", query.trim());
      if (selectedLevels.length) params.set("levels", selectedLevels.join(","));
      params.set("page", String(currentPage + 1));
      params.set("pageSize", String(currentPageSize));
      const response = await fetch(`${apiBaseUrl}/companies?${params.toString()}`);
      if (!response.ok) throw new Error();
      const data: CompanyPage = await response.json();
      if (data.items.length === 0 && data.total > 0 && currentPage > 0) {
        setPage(0);
        return;
      }
      setCompanies(data.items);
      setTotal(data.total);
    } catch { setNotice("无法加载公司数据，请确认后端服务已启动。"); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedNameQuery(nameQuery), 250);
    return () => window.clearTimeout(timer);
  }, [nameQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCompanies(debouncedNameQuery, levels, page, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [debouncedNameQuery, levels, page, pageSize, loadCompanies]);

  return <DashboardShell title="Company"><Stack spacing={3}>
    <Typography color="text.secondary">按公司名称搜索，按 Level 多选过滤；点击每行箭头查看公司详情。</Typography>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
      <TextField label="按公司名搜索" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} sx={{ width: { xs: "100%", md: 380 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
      <FormControl sx={{ minWidth: 280 }}><InputLabel id="level-filter-label">按 Level 多选过滤</InputLabel><Select labelId="level-filter-label" multiple value={levels} onChange={(event) => setLevels(typeof event.target.value === "string" ? event.target.value.split(",").map(Number) : event.target.value)} input={<OutlinedInput label="按 Level 多选过滤" />} renderValue={(selected) => <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{selected.map((level) => <Chip key={level} label={`Level ${level}`} size="small" />)}</Box>}>
        {companyLevels.map((level) => <MenuItem key={level} value={level}><Checkbox checked={levels.includes(level)} /><ListItemText primary={`Level ${level}`} /></MenuItem>)}
      </Select></FormControl>
    </Stack>
    <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell padding="checkbox" /><TableCell>名称</TableCell><TableCell>等级</TableCell><TableCell>国家</TableCell><TableCell>盈利效率</TableCell></TableRow></TableHead><TableBody>
      {companies.map((company) => <CompanyRow key={company.companyCode} company={company} />)}
      {!companies.length && <TableRow><TableCell colSpan={5} align="center">没有找到公司</TableCell></TableRow>}
    </TableBody></Table></TableContainer>
    <TablePagination component="div" count={total} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={pageSize} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[20, 50, 100]} labelRowsPerPage="每页显示" />
  </Stack><Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}><Alert severity="error" variant="filled">{notice}</Alert></Snackbar></DashboardShell>;
}
