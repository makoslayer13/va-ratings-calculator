// Cloudflare Pages Function: POST /subscribe
// Adds the submitted email to MailerLite (server-side, token never reaches the browser),
// then redirects to the unlocked page. No-JS friendly plain HTML form POST.

export async function onRequestPost({ request, env }) {
  const origin = new URL(request.url).origin;
  const fail = (msg) => Response.redirect(`${origin}/va-claims-prompt/?error=${encodeURIComponent(msg)}`, 303);

  let email = "";
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.json();
      email = (body.email || "").trim();
    } else {
      const form = await request.formData();
      email = (form.get("email") || "").trim();
    }
  } catch {
    return fail("bad_request");
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return fail("invalid_email");
  }

  if (!env.MAILERLITE_TOKEN || !env.MAILERLITE_GROUP_ID) {
    return fail("not_configured");
  }

  try {
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MAILERLITE_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        groups: [env.MAILERLITE_GROUP_ID],
        fields: { source: "va_claims_prompt_lead_magnet" },
      }),
    });

    if (!res.ok && res.status !== 422) {
      // 422 from MailerLite usually just means "already subscribed" — treat as success.
      return fail("subscribe_failed");
    }
  } catch {
    return fail("network_error");
  }

  return Response.redirect(`${origin}/va-claims-prompt/unlocked/`, 303);
}
