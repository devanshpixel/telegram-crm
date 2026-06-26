import { NextResponse } from "next/server";

export async function GET() {
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Successful</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b0b0f;color:#e7e7ea;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{text-align:center;max-width:420px;padding:32px;background:#14141a;border-radius:16px;border:1px solid #22222b}
.icon{font-size:48px;margin-bottom:16px}
h1{font-size:20px;font-weight:600;margin-bottom:8px}
p{color:#9a9aa3;line-height:1.6;font-size:14px}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #22222b;font-size:12px;color:#6b6b76}
a{color:#8b5cf6;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body><div class="card"><div class="icon">✅</div><h1>Payment Successful!</h1><p>Your premium access has been unlocked. You can now enjoy exclusive content.<br><br>Check your Telegram for a confirmation message.</p><div class="footer">Go back to <a href="https://t.me/nayrasingh">Telegram</a></div></div></body>
</html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
