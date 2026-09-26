"use client";

import { Alert, Box, Button, Card, CardContent, CircularProgress, Link as MuiLink, Snackbar, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

// 这个组件会同时用于 /login 和 /sign-up 两个页面。
type Mode = "login" | "sign-up";

// 表单每个字段对应的错误信息；? 表示该字段可以暂时没有错误。
type FieldErrors = { email?: string; password?: string };

// 前端先做一次简单邮箱格式检查；后端仍会再检查一次，不能只相信前端。
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// .env 中可配置 API 地址；本地没有配置时，默认请求 NestJS 的 3001 端口。
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function AuthCard({ mode }: { mode: Mode }) {
  // router 用于登录/注册成功后的前端页面跳转。
  const router = useRouter();

  // 同一个组件通过 mode 判断：现在是注册页，还是登录页。
  const isSignUp = mode === "sign-up";

  // React state：用户每输入一次内容，setEmail / setPassword 会更新页面。
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // errors 用于让 MUI TextField 显示红色提示文字。
  const [errors, setErrors] = useState<FieldErrors>({});

  // 提交期间禁用按钮，防止用户连续点击、发出多个相同请求。
  const [submitting, setSubmitting] = useState(false);

  // notice 控制底部弹出的成功/错误提示（Snackbar）。
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  function validate() {
    // 每次提交时都重新生成错误对象，避免保留上一次已经修正的错误。
    const nextErrors: FieldErrors = {};
    if (!email.trim()) nextErrors.email = "请输入电子邮箱";
    else if (!emailPattern.test(email)) nextErrors.email = "请输入正确的邮箱格式";
    if (!password) nextErrors.password = "请输入密码";
    else if (isSignUp && password.length < 8) nextErrors.password = "密码至少需要 8 个字符";

    // 将错误交给 React state，页面会据此显示提示。
    setErrors(nextErrors);

    // 没有任何错误时才返回 true，允许继续请求后端。
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 浏览器默认会在 form 提交后刷新页面；React 单页应用不希望刷新。
    event.preventDefault();

    // 前端输入不合法时，到这里直接结束，不需要浪费一次 API 请求。
    if (!validate()) return;

    // 进入“提交中”状态：按钮变为 loading，旧提示被清除。
    setSubmitting(true);
    setNotice(null);

    try {
      // isSignUp 决定请求注册接口还是登录接口。
      // email.trim() 清除前后空格，toLowerCase() 统一邮箱的大小写。
      const response = await fetch(`${apiBaseUrl}/users/${isSignUp ? "sign-up" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // HTTP 只能传文本；JSON.stringify 把 JavaScript 对象变成 JSON 文本。
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      // 后端通常返回 JSON。catch 让“后端异常但未返回 JSON”时也不会让前端崩溃。
      const data: { message?: string | string[] } = await response.json().catch(() => ({}));

      // NestJS 的验证错误 message 可能是字符串数组；这里统一取第一条显示。
      const message = Array.isArray(data.message) ? data.message[0] : data.message;

      // 200 / 201 等成功状态码时 response.ok 为 true；401、409 等失败时为 false。
      if (!response.ok) {
        setNotice({ severity: "error", text: message ?? "请求失败，请稍后重试" });
        return;
      }

      // 请求成功：先显示成功提示，再短暂停留后跳转。
      setNotice({ severity: "success", text: isSignUp ? "注册成功，请登录" : "登录成功，正在进入 Dashboard" });
      window.setTimeout(() => router.push(isSignUp ? "/login" : "/dashboard"), 700);
    } catch {
      // 网络断开、后端未启动等情况会进入这里，而不是上面的 response.ok 判断。
      setNotice({ severity: "error", text: "无法连接后端服务，请确认 API 已启动" });
    } finally {
      // finally 无论成功、失败、抛异常都会执行，确保按钮恢复可点击。
      setSubmitting(false);
    }
  }

  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
    <Card sx={{ width: "100%", maxWidth: 440 }} elevation={4}><CardContent sx={{ p: { xs: 3, sm: 4 } }}>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>{isSignUp ? "创建账户" : "欢迎回来"}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{isSignUp ? "注册后即可进入管理后台。" : "请使用你的账户登录管理后台。"}</Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: "grid", gap: 2 }}>
        <TextField label="电子邮箱" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={Boolean(errors.email)} helperText={errors.email} autoComplete="email" required fullWidth />
        <TextField label="密码" type="password" value={password} onChange={(event) => setPassword(event.target.value)} error={Boolean(errors.password)} helperText={errors.password ?? (isSignUp ? "至少 8 个字符" : "")} autoComplete={isSignUp ? "new-password" : "current-password"} required fullWidth />
        <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ mt: 1 }}>{submitting ? <CircularProgress size={24} color="inherit" /> : isSignUp ? "注册" : "登录"}</Button>
      </Box>
      <Typography variant="body2" align="center" sx={{ mt: 3 }}>{isSignUp ? "已有账户？" : "还没有账户？"}<MuiLink component={Link} href={isSignUp ? "/login" : "/sign-up"} sx={{ ml: 0.5 }}>{isSignUp ? "去登录" : "立即注册"}</MuiLink></Typography>
    </CardContent></Card>
    <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.severity} variant="filled">{notice.text}</Alert> : undefined}</Snackbar>
  </Box>;
}
