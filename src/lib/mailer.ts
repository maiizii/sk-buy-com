import nodemailer from "nodemailer";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getPort() {
  const raw = process.env.SMTP_PORT?.trim() || "465";
  const port = Number(raw);
  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT is invalid");
  }
  return port;
}

export function createMailer() {
  const host = getRequiredEnv("SMTP_HOST");
  const port = getPort();
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");
  const secure = String(process.env.SMTP_SECURE || port === 465).toLowerCase() === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendVerificationEmail(params: {
  to: string;
  verificationUrl: string;
  verificationCode?: string;
  displayName?: string;
}) {
  const transporter = createMailer();
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "";
  const appName = process.env.APP_NAME?.trim() || "sk-buy";
  const safeName = params.displayName?.trim() || params.to;

  return transporter.sendMail({
    from: from.includes("<") ? from : `${appName} <${from}>`,
    to: params.to,
    subject: `请验证你的 ${appName} 邮箱`,
    text: [
      `你好，${safeName}：`,
      "",
      "请点击下面的链接完成邮箱验证：",
      params.verificationUrl,
      params.verificationCode ? "" : undefined,
      params.verificationCode ? `验证码：${params.verificationCode}` : undefined,
      params.verificationCode ? "你也可以在站内输入这 6 位验证码完成验证。" : undefined,
      "",
      "如果这不是你的操作，请忽略本邮件。",
    ].filter(Boolean).join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#111827">
        <h2 style="margin:0 0 16px">验证你的邮箱</h2>
        <p>你好，${safeName}：</p>
        <p>请点击下面按钮完成 <strong>${appName}</strong> 邮箱验证：</p>
        <p style="margin:24px 0">
          <a href="${params.verificationUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px">立即验证邮箱</a>
        </p>
        <p>如果按钮无法点击，请复制这个链接到浏览器打开：</p>
        <p><a href="${params.verificationUrl}">${params.verificationUrl}</a></p>
        ${params.verificationCode
          ? `<div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
              <div style="font-size:12px;color:#6b7280;margin-bottom:8px">邮箱验证码</div>
              <div style="font-size:28px;letter-spacing:6px;font-weight:700;color:#111827">${params.verificationCode}</div>
              <div style="margin-top:8px;font-size:13px;color:#6b7280">你也可以在站内输入这 6 位验证码完成验证。</div>
            </div>`
          : ""}
        <p style="color:#6b7280">如果这不是你的操作，请忽略本邮件。</p>
      </div>
    `,
  });
}
