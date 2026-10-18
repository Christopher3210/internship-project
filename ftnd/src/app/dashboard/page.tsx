"use client";

import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { ArcElement, CategoryScale, Chart as ChartJS, LineElement, LinearScale, PointElement, Tooltip as ChartTooltip } from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import { DashboardShell } from "@/components/DashboardShell";

ChartJS.register(ArcElement, CategoryScale, LineElement, LinearScale, PointElement, ChartTooltip);

type DashboardSummary = {
  companyCount: number;
  totalRevenue: number;
  countryCount: number;
  employeeCount: number;
};

type LevelDistribution = {
  totalCompanies: number;
  levels: { level: number; companyCount: number; percentage: number }[];
};

type FoundedYearTrend = {
  years: { year: number; newCompanies: number; cumulativeCompanies: number }[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const exactNumber = new Intl.NumberFormat("en-US");
const levelColors = ["#2563eb", "#06b6d4", "#f59e0b", "#10b981", "#a855f7"];

function colorForLevel(level: number) {
  return levelColors[(level - 1) % levelColors.length];
}

const metrics: { key: keyof DashboardSummary; label: string }[] = [
  { key: "companyCount", label: "公司数量" },
  { key: "totalRevenue", label: "总收入" },
  { key: "countryCount", label: "覆盖国家" },
  { key: "employeeCount", label: "员工数量" },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [levelDistribution, setLevelDistribution] = useState<LevelDistribution | null>(null);
  const [levelsError, setLevelsError] = useState(false);
  const [foundedYearTrend, setFoundedYearTrend] = useState<FoundedYearTrend | null>(null);
  const [foundedYearError, setFoundedYearError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBaseUrl}/dashboard/summary`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Dashboard summary request failed");
        return response.json() as Promise<DashboardSummary>;
      })
      .then(setSummary)
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBaseUrl}/dashboard/founded-years`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Founded-year trend request failed");
        return response.json() as Promise<FoundedYearTrend>;
      })
      .then(setFoundedYearTrend)
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setFoundedYearError(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBaseUrl}/dashboard/levels`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Level distribution request failed");
        return response.json() as Promise<LevelDistribution>;
      })
      .then(setLevelDistribution)
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setLevelsError(true);
      });

    return () => controller.abort();
  }, []);

  const chartData = levelDistribution
    ? {
        labels: levelDistribution.levels.map((item) => `Level ${item.level}`),
        datasets: [{
          data: levelDistribution.levels.map((item) => item.companyCount),
          backgroundColor: levelDistribution.levels.map((item) => colorForLevel(item.level)),
          borderWidth: 0,
          hoverOffset: 8,
        }],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { dataIndex: number }) => {
            const item = levelDistribution?.levels[context.dataIndex];
            return item
              ? `Level ${item.level}: ${exactNumber.format(item.companyCount)} 家 (${item.percentage}%)`
              : "";
          },
        },
      },
    },
  };

  const foundedYearChartData = foundedYearTrend
    ? {
        labels: foundedYearTrend.years.map((item) => item.year.toString()),
        datasets: [{
          label: "累计公司数",
          data: foundedYearTrend.years.map((item) => item.cumulativeCompanies),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          fill: true,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 6,
        }],
      }
    : null;

  const foundedYearChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            const item = foundedYearTrend?.years[items[0]?.dataIndex];
            return item ? item.year.toString() : "";
          },
          label: (context: { dataIndex: number }) => {
            const item = foundedYearTrend?.years[context.dataIndex];
            return item ? `累计公司数：${exactNumber.format(item.cumulativeCompanies)}` : "";
          },
          afterBody: (items: { dataIndex: number }[]) => {
            const item = foundedYearTrend?.years[items[0]?.dataIndex];
            return item ? `当年新增：${exactNumber.format(item.newCompanies)}` : "";
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (value: string | number) => exactNumber.format(Number(value)) } },
    },
  };

  return (
    <DashboardShell title="Dashboard">
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={700}>供应链概览</Typography>
          <Typography color="text.secondary" variant="body2">
            以下数据根据公司数据库实时汇总。
          </Typography>
        </Box>

        {error && <Alert severity="error">无法加载概览数据，请确认后端和数据库已启动。</Alert>}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
          {metrics.map(({ key, label }) => {
            const value = summary?.[key];
            return (
              <Card key={key} variant="outlined" sx={{ borderRadius: 3, minHeight: 142 }}>
                <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <Typography color="text.secondary" variant="body2">{label}</Typography>
                  {value === undefined ? (
                    <Box sx={{ display: "flex", alignItems: "center", minHeight: 50 }}>
                      {error ? <Typography color="text.disabled">—</Typography> : <CircularProgress size={24} />}
                    </Box>
                  ) : (
                    <>
                      <Typography variant="h4" component="p" fontWeight={700} sx={{ my: 1 }}>
                        {compactNumber.format(value)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        精确值：{exactNumber.format(value)}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>供应商等级分布</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
              各等级公司数量及其占全部公司的比例
            </Typography>
            {levelsError ? (
              <Alert severity="error">无法加载等级分布，请确认后端服务已启动。</Alert>
            ) : !levelDistribution || !chartData ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>
            ) : levelDistribution.levels.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 5, textAlign: "center" }}>暂无等级数据</Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(240px, 1fr) minmax(280px, 1.2fr)" }, gap: 3, alignItems: "center" }}>
                <Box sx={{ height: 280, maxWidth: 340, width: "100%", mx: "auto" }}>
                  <Doughnut data={chartData} options={chartOptions} />
                </Box>
                <Box sx={{ overflowX: "auto" }}>
                  <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", "& th, & td": { py: 1.25, px: 1, borderBottom: 1, borderColor: "divider", textAlign: "right" }, "& th:first-of-type, & td:first-of-type": { textAlign: "left" }, "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
                    <thead><tr><th>等级</th><th>公司数量</th><th>占比</th></tr></thead>
                    <tbody>
                      {levelDistribution.levels.map((item) => (
                        <tr key={item.level}>
                          <td><Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colorForLevel(item.level) }} />Level {item.level}</Box></td>
                          <td>{exactNumber.format(item.companyCount)}</td>
                          <td>{item.percentage}%</td>
                        </tr>
                      ))}
                      <tr><td><strong>总计</strong></td><td><strong>{exactNumber.format(levelDistribution.totalCompanies)}</strong></td><td><strong>100%</strong></td></tr>
                    </tbody>
                  </Box>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>供应链网络公司累计增长</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
              按公司成立年份展示累计数量；将鼠标悬停在年份上可查看当年新增公司数。
            </Typography>
            {foundedYearError ? (
              <Alert severity="error">无法加载年度趋势，请确认后端服务已启动。</Alert>
            ) : !foundedYearTrend || !foundedYearChartData ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>
            ) : foundedYearTrend.years.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 5, textAlign: "center" }}>暂无成立年份数据</Typography>
            ) : (
              <Box sx={{ height: 340, width: "100%" }}>
                <Line data={foundedYearChartData} options={foundedYearChartOptions} />
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>
    </DashboardShell>
  );
}
