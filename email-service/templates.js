const copy = {
  verify: {
    subject: "Verify your email — Assumptions Management",
    heading: "One step before you begin",
    intro:
      "Verify your email address to start working with your project team in Assumptions Management.",
    button: "Verify my email",
    after: "After verifying, return to Assumptions Management and sign in.",
    ignore: "If you did not create an account, you can ignore this email.",
  },
  reset: {
    subject: "Reset your password — Assumptions Management",
    heading: "Choose a new password",
    intro:
      "We received a request to reset the password for your Assumptions Management account.",
    button: "Reset my password",
    after:
      "After choosing a new password, return to Assumptions Management and sign in.",
    ignore:
      "If you did not request this, ignore this email. Your password will not change.",
  },
};
const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export function renderAuthEmail(
  kind,
  actionLink,
  actionOrigin,
  allowEmulatorLinks = false,
) {
  const content = copy[kind];
  const link = new URL(actionLink);
  const emulatorLink =
    allowEmulatorLinks &&
    link.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(link.hostname) &&
    link.pathname === "/emulator/action";
  if (
    !content ||
    (link.protocol !== "https:" && !emulatorLink) ||
    link.origin !== actionOrigin ||
    (link.pathname !== "/__/auth/action" && !emulatorLink) ||
    link.searchParams.get("mode") !==
      (kind === "verify" ? "verifyEmail" : "resetPassword") ||
    !link.searchParams.get("oobCode") ||
    link.username ||
    link.password
  )
    throw new Error("Invalid email action link.");
  const url = link.href;
  return {
    subject: content.subject,
    text: `Assumptions Management\n\n${content.heading}\n\n${content.intro}\n\n${content.button}:\n${url}\n\n${content.after}\n\nIf this link is expired or already used, request a new email from the app.\n\n${content.ignore}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${content.subject}</title></head>
<body style="margin:0;background:#f2f5f8;color:#243247;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dbe2eb;border-radius:12px">
<tr><td style="padding:32px"><p style="font-size:14px;font-weight:bold;color:#465b79;margin:0 0 28px">ASSUMPTIONS MANAGEMENT</p>
<h1 style="font-size:28px;line-height:1.2;margin:0 0 18px;color:#16263e">${content.heading}</h1>
<p style="font-size:16px;line-height:1.6">${content.intro}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td bgcolor="#175dcc" style="border-radius:6px">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:15px 24px;border:1px solid #175dcc;border-radius:6px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px">${content.button}</a>
</td></tr></table>
<p style="font-size:15px;line-height:1.6">${content.after}</p>
<p style="font-size:13px;line-height:1.6;color:#536178">If the button does not work, copy and paste this link into your browser:</p>
<p style="font-size:12px;line-height:1.6;overflow-wrap:anywhere;word-break:break-all"><a href="${escapeHtml(url)}" style="color:#175dcc">${escapeHtml(url)}</a></p>
<p style="font-size:13px;line-height:1.6;color:#536178">If this link is expired or already used, request a new email from the app.</p>
<hr style="border:0;border-top:1px solid #dbe2eb;margin:26px 0">
<p style="font-size:13px;line-height:1.6;color:#536178;margin:0">${content.ignore}</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
