// Supabase Edge Function: notify
//
// Sends an email (via Gmail SMTP) and posts an Adaptive Card to Teams (via an
// incoming webhook) when a goal lifecycle event happens. Called from the
// browser as fire-and-forget; never blocks the user flow.
//
// Deploy:
//   supabase functions deploy notify
//
// Secrets:
//   supabase secrets set GMAIL_USER=you@gmail.com
//   supabase secrets set GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
//   supabase secrets set GMAIL_FROM_NAME="AtomAlign Notifications"  # optional
//   supabase secrets set TEAMS_WEBHOOK_URL=...                       # optional
//   supabase secrets set APP_BASE_URL=https://atomalign.vercel.app
//
// Request body:
//   { event: "submitted" | "approved" | "returned" | "checkin_saved",
//     sheet_id: string,
//     actor_id: string,
//     remark?: string,
//     quarter?: "Q1"|"Q2"|"Q3"|"Q4" }

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const GMAIL_FROM_NAME = Deno.env.get("GMAIL_FROM_NAME") ?? "AtomAlign Notifications";
const TEAMS_WEBHOOK_URL = Deno.env.get("TEAMS_WEBHOOK_URL") ?? "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://atomalign.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EventType =
  | "submitted"
  | "approved"
  | "returned"
  | "checkin_saved"
  | "escalation"
  | "user_created";

interface Payload {
  event: EventType;
  sheet_id?: string;
  actor_id: string;
  recipient_id?: string;
  remark?: string;
  quarter?: string;
  // user_created only: plaintext password to ship in the welcome email.
  // Acceptable here because the admin just typed it and it's about to be
  // delivered to the rightful owner. Same posture as demo-credentials.md.
  password?: string;
}

interface Recipient {
  email: string;
  name: string;
}

interface Context {
  employee: Recipient;
  manager: Recipient | null;
  sheetUrl: string;
  cycleYear: number;
}

function subjectFor(event: EventType, ctx: Context, payload: Payload): string {
  switch (event) {
    case "submitted":
      return `${ctx.employee.name} submitted goals for your review`;
    case "approved":
      return `Your ${ctx.cycleYear} goals have been approved`;
    case "returned":
      return `Your ${ctx.cycleYear} goals need revision`;
    case "checkin_saved":
      return `${ctx.employee.name} logged a check-in`;
    case "escalation":
      return `Escalation: action required regarding ${ctx.employee.name}`;
  }
}

function bodyHtml(event: EventType, ctx: Context, payload: Payload): string {
  const link = `<a href="${ctx.sheetUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Open goal sheet</a>`;
  const wrap = (inner: string) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AtomAlign</title></head><body style="margin:0;padding:0;background:#f8fafc"><div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;background:#ffffff"><h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">${subjectFor(event, ctx, payload)}</h2>${inner}<p style="margin:24px 0 16px">${link}</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"><p style="font-size:12px;color:#64748b;margin:0">Sent by AtomAlign - Goal Setting &amp; Tracking Portal</p></div></body></html>`;
  switch (event) {
    case "submitted":
      return wrap(
        `<p>Hi ${ctx.manager?.name ?? "there"},</p><p><strong>${ctx.employee.name}</strong> submitted their ${ctx.cycleYear} goals for your review.</p>`,
      );
    case "approved":
      return wrap(
        `<p>Hi ${ctx.employee.name},</p><p>Your ${ctx.cycleYear} goals have been approved${
          payload.remark ? `. Manager note: <em>${payload.remark}</em>` : ""
        }.</p>`,
      );
    case "returned":
      return wrap(
        `<p>Hi ${ctx.employee.name},</p><p>Your ${ctx.cycleYear} goals were returned for revision${
          payload.remark ? `: <em>${payload.remark}</em>` : ""
        }.</p>`,
      );
    case "checkin_saved":
      return wrap(
        `<p>Hi ${ctx.manager?.name ?? "there"},</p><p><strong>${ctx.employee.name}</strong> logged a ${payload.quarter ?? ""} check-in.</p>`,
      );
    case "escalation":
      return wrap(
        `<p>This is an automated escalation from AtomAlign.</p><p><strong>Subject:</strong> ${ctx.employee.name}${ctx.employee.email ? ` (${ctx.employee.email})` : ""}</p><p><strong>Reason:</strong> ${payload.remark ?? "Action required."}</p><p>Please follow up to keep the ${ctx.cycleYear} goal cycle on track.</p>`,
      );
  }
}

function bodyText(event: EventType, ctx: Context, payload: Payload): string {
  switch (event) {
    case "submitted":
      return `${ctx.employee.name} submitted their ${ctx.cycleYear} goals for your review.\n\nOpen: ${ctx.sheetUrl}`;
    case "approved":
      return `Your ${ctx.cycleYear} goals have been approved${
        payload.remark ? `. Manager note: ${payload.remark}` : ""
      }.\n\nOpen: ${ctx.sheetUrl}`;
    case "returned":
      return `Your ${ctx.cycleYear} goals were returned for revision${
        payload.remark ? `: ${payload.remark}` : ""
      }.\n\nOpen: ${ctx.sheetUrl}`;
    case "checkin_saved":
      return `${ctx.employee.name} logged a ${payload.quarter ?? ""} check-in.\n\nOpen: ${ctx.sheetUrl}`;
    case "escalation":
      return `Automated escalation.\n\nSubject: ${ctx.employee.name}${ctx.employee.email ? ` (${ctx.employee.email})` : ""}\nReason: ${payload.remark ?? "Action required."}\n\nOpen: ${ctx.sheetUrl}`;
  }
}

function teamsCard(event: EventType, ctx: Context, payload: Payload) {
  const facts = [
    { title: "Employee", value: ctx.employee.name },
    { title: "Cycle", value: String(ctx.cycleYear) },
  ];
  if (payload.quarter) facts.push({ title: "Quarter", value: payload.quarter });
  if (payload.remark) facts.push({ title: "Remark", value: payload.remark });

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `AtomAlign — ${event.replace("_", " ")}`,
              weight: "Bolder",
              size: "Medium",
            },
            { type: "FactSet", facts },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Open goal sheet",
              url: ctx.sheetUrl,
            },
          ],
        },
      },
    ],
  };
}

function welcomeHtml(
  name: string,
  email: string,
  password: string | undefined,
  loginUrl: string,
  role: string,
): string {
  const cta = `<a href="${loginUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Sign in to AtomAlign</a>`;
  const credBlock = password
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px"><tr><td style="padding:10px 14px;font-size:13px;color:#475569;width:120px">Email</td><td style="padding:10px 14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px">${email}</td></tr><tr><td style="padding:10px 14px;font-size:13px;color:#475569;border-top:1px solid #e2e8f0">Password</td><td style="padding:10px 14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;border-top:1px solid #e2e8f0">${password}</td></tr><tr><td style="padding:10px 14px;font-size:13px;color:#475569;border-top:1px solid #e2e8f0">Role</td><td style="padding:10px 14px;font-size:13px;border-top:1px solid #e2e8f0">${role}</td></tr></table>`
    : `<p style="margin:8px 0">Email: <strong>${email}</strong> &middot; Role: <strong>${role}</strong></p>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Welcome to AtomAlign</title></head><body style="margin:0;padding:0;background:#f8fafc"><div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;background:#ffffff"><h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">Welcome to AtomAlign, ${name}</h2><p style="margin:0 0 8px">Your admin has set up an account for you on AtomAlign - the goal setting and tracking portal.</p>${credBlock}<p style="margin:24px 0 16px">${cta}</p><p style="font-size:13px;color:#475569;margin:0 0 8px">You can also sign in with your Microsoft account using the same email address.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"><p style="font-size:12px;color:#64748b;margin:0">Sent by AtomAlign - Goal Setting &amp; Tracking Portal</p></div></body></html>`;
}

function welcomeText(
  name: string,
  email: string,
  password: string | undefined,
  loginUrl: string,
): string {
  const lines = [
    `Welcome to AtomAlign, ${name}.`,
    "",
    "Your admin has set up an account for you on AtomAlign.",
    "",
    `Email:    ${email}`,
  ];
  if (password) lines.push(`Password: ${password}`);
  lines.push("");
  lines.push(`Sign in: ${loginUrl}`);
  lines.push("");
  lines.push("You can also sign in with your Microsoft account using the same email address.");
  return lines.join("\n");
}

function welcomeTeamsCard(name: string, email: string, loginUrl: string) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `Welcome to AtomAlign, ${name}`,
              weight: "Bolder",
              size: "Medium",
            },
            { type: "FactSet", facts: [{ title: "Email", value: email }] },
          ],
          actions: [
            { type: "Action.OpenUrl", title: "Sign in", url: loginUrl },
          ],
        },
      },
    ],
  };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn("[notify] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email");
    return { ok: false, reason: "no_credentials" };
  }
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: GMAIL_USER,
        password: GMAIL_APP_PASSWORD,
      },
    },
  });
  try {
    await client.send({
      from: `${GMAIL_FROM_NAME} <${GMAIL_USER}>`,
      to,
      subject,
      content: text,
      html,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[notify] gmail smtp failed", e);
    return { ok: false, reason: String(e) };
  } finally {
    try {
      await client.close();
    } catch {
      /* noop */
    }
  }
}

async function sendTeams(card: unknown) {
  if (!TEAMS_WEBHOOK_URL) {
    console.warn("[notify] TEAMS_WEBHOOK_URL not set — skipping Teams card");
    return { ok: false, reason: "no_webhook" };
  }
  const res = await fetch(TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[notify] teams failed", res.status, text);
    return { ok: false, reason: text };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!payload?.event || !payload?.actor_id) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Welcome email path (admin-created users via the Create Team wizard).
  // Bypasses the goal-sheet/manager resolution since there's no sheet yet and
  // the recipient IS the subject.
  if (payload.event === "user_created") {
    if (!payload.recipient_id) {
      return new Response(
        JSON.stringify({ error: "missing_recipient_id" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    const { data: newUser, error: newUserErr } = await admin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", payload.recipient_id)
      .single();
    if (newUserErr || !newUser?.email) {
      return new Response(
        JSON.stringify({ error: "recipient_not_found", detail: newUserErr?.message }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    const loginUrl = `${APP_BASE_URL}/login`;
    const name = newUser.full_name || newUser.email;
    const subject = "Welcome to AtomAlign - your sign-in details";
    const html = welcomeHtml(name, newUser.email, payload.password, loginUrl, newUser.role);
    const text = welcomeText(name, newUser.email, payload.password, loginUrl);
    const card = welcomeTeamsCard(name, newUser.email, loginUrl);

    const [emailRes, teamsRes] = await Promise.all([
      sendEmail(newUser.email, subject, html, text),
      sendTeams(card),
    ]);
    return new Response(
      JSON.stringify({ ok: true, email: emailRes, teams: teamsRes }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Look up sheet if provided (optional for escalation events)
  let sheet: { id: string; employee_id: string; cycle_year: number } | null = null;
  if (payload.sheet_id) {
    const { data } = await admin
      .from("goal_sheets")
      .select("id, employee_id, cycle_year")
      .eq("id", payload.sheet_id)
      .maybeSingle();
    if (data) sheet = data as any;
  }

  // Subject = the person the event is *about*. For sheet-based events that's
  // the sheet's owner; for escalations it's actor_id.
  const subjectId = sheet?.employee_id ?? payload.actor_id;

  const { data: subjectProfile, error: subjErr } = await admin
    .from("profiles")
    .select("id, full_name, email, manager_id")
    .eq("id", subjectId)
    .single();
  if (subjErr || !subjectProfile) {
    return new Response(
      JSON.stringify({ error: "subject_not_found", detail: subjErr?.message }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let manager: Recipient | null = null;
  if (subjectProfile.manager_id) {
    const { data: m } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", subjectProfile.manager_id)
      .single();
    if (m) manager = { name: m.full_name || m.email, email: m.email };
  }

  const ctx: Context = {
    employee: { name: subjectProfile.full_name || subjectProfile.email, email: subjectProfile.email },
    manager,
    sheetUrl: `${APP_BASE_URL}/employee/goals`,
    cycleYear: sheet?.cycle_year ?? new Date().getFullYear(),
  };

  // Recipient routing:
  //   - explicit recipient_id (escalation flow) → use that profile
  //   - approved/returned → employee (subject)
  //   - submitted/checkin_saved → manager
  let recipient: Recipient | null = null;
  if (payload.recipient_id) {
    const { data: r } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", payload.recipient_id)
      .single();
    if (r) recipient = { name: r.full_name || r.email, email: r.email };
  } else {
    const toEmployee = payload.event === "approved" || payload.event === "returned";
    recipient = toEmployee ? ctx.employee : manager;
  }

  if (!recipient?.email) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "no_recipient" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const subject = subjectFor(payload.event, ctx, payload);
  const html = bodyHtml(payload.event, ctx, payload);
  const text = bodyText(payload.event, ctx, payload);
  const card = teamsCard(payload.event, ctx, payload);

  const [emailRes, teamsRes] = await Promise.all([
    sendEmail(recipient.email, subject, html, text),
    sendTeams(card),
  ]);

  return new Response(
    JSON.stringify({ ok: true, email: emailRes, teams: teamsRes }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
