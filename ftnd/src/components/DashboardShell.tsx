"use client";

import { BusinessOutlined, DashboardOutlined, GroupOutlined, Inventory2Outlined } from "@mui/icons-material";
import { Box, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const drawerWidth = 248;
const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardOutlined /> }, { label: "Company", href: "/company", icon: <BusinessOutlined /> },
  { label: "Order", href: "/order", icon: <Inventory2Outlined /> }, { label: "User", href: "/user", icon: <GroupOutlined /> },
];

export function DashboardShell({ title, children }: { title: string; children?: ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  return <Box sx={{ display: "flex", minHeight: "100vh" }}>
    <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" } }}>
      <Toolbar><Typography variant="h6" fontWeight={800}>Internship Admin</Typography></Toolbar><Divider />
      <List sx={{ p: 1 }}>{navigation.map((item) => <ListItemButton key={item.href} selected={pathname === item.href} onClick={() => router.push(item.href)} sx={{ borderRadius: 2, mb: 0.5 }}><ListItemIcon>{item.icon}</ListItemIcon><ListItemText primary={item.label} /></ListItemButton>)}</List>
    </Drawer>
    <Box component="main" sx={{ flexGrow: 1, p: { xs: 3, md: 5 } }}><Typography variant="h4" component="h1" fontWeight={700} gutterBottom>{title}</Typography>{children ?? <Typography color="text.secondary">此页面将在后续任务中补充业务功能。</Typography>}</Box>
  </Box>;
}
