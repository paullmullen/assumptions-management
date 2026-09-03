export function createSmtp2goSender({ apiKey, sender, fetchImpl = fetch }) {
  if (!apiKey || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender))
    throw new Error("Email delivery is not configured.");
  return async ({ to, subject, html, text }) => {
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to))
      throw new Error("Invalid recipient.");
    let response;
    try {
      response = await fetchImpl("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Smtp2go-Api-Key": apiKey,
        },
        body: JSON.stringify({
          sender: `Assumptions Management <${sender}>`,
          to: [to],
          subject,
          html_body: html,
          text_body: text,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok || body.data?.succeeded !== 1 || body.data?.failed !== 0)
        throw new Error("Delivery rejected.");
    } catch {
      // Do not log provider payloads, credentials, addresses, or action links.
      // Do not automatically resend when an acknowledgement may have been lost.
      throw new Error("Email delivery could not be confirmed.");
    }
  };
}
