// Supabase Edge Function: notify
//
// Sends an email (via Resend) and posts an Adaptive Card to Teams (via an
// incoming webhook) when a goal lifecycle event happens. Called from the
// browser as fire-and-forget; never blocks the user flow.
//
// Deploy:
//   supabase functions deploy notify --no-verify-jwt
//
// Secrets:
//   supabase secrets set RESEND_API_KEY=...
//   supabase secrets set RESEND_FROM="AtomAlign <onboarding@resend.dev>"
//   supabase secrets set TEAMS_WEBHOOK_URL=...   # optional
//   supabase secrets set APP_BASE_URL=https://atomalign.vercel.app
//
// Request body:
//   { event: "submitted" | "approved" | "returned" | "checkin_saved",
//     sheet_id: string,
//     actor_id: string,        // user who triggered the event
//     remark?: string,
//     quarter?: "Q1"|"Q2"|"Q3"|"Q4" }

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "AtomAlign <onboarding@resend.dev>";
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

type EventType = "submitted" | "approved" | "returned" | "checkin_saved";

interface Payload {
  event: EventType;
  sheet_id: string;
  actor_id: string;
  remark?: string;
  quarter?: string;
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

function subjectFor(event: EventType, ctx: Context): string {
  switch (event) {
    case "submitted":
      return `${ctx.employee.name} submitted goals for your review`;
    case "approved":
      return `Your ${ctx.cycleYear} goals have been approved`;
    case "returned":
      return `Your ${ctx.cycleYear} goals need revision`;
    case "checkin_saved":
      return `${ctx.employee.name} logged a check-in`;
  }
}

function bodyHtml(event: EventType, ctx: Context, payload: Payload): string {
  const link = `<a href="${ctx.sheetUrl}">Open goal sheet</a>`;
  switch (event) {
    case "submitted":
      return `
        <p>Hi ${ctx.manager?.name ?? "there"},</p>
        <p><strong>${ctx.employee.name}</strong> submitted their ${ctx.cycleYear} goals for your review.</p>
        <p>${link}</p>`;
    case "approved":
      return `
        <p>Hi ${ctx.employee.name},</p>
        <p>Your ${ctx.cycleYear} goals have been approved${
          payload.remark ? `. Manager note: <em>${payload.remark}</em>` : ""
        }.</p>
        <p>${link}</p>`;
    case "returned":
      return `
        <p>Hi ${ctx.employee.name},</p>
        <p>Your ${ctx.cycleYear} goals were returned for revision${
          payload.remark ? `: <em>${payload.remark}</em>` : ""
        }.</p>
        <p>${link}</p>`;
    case "checkin_saved":
      return `
        <p>Hi ${ctx.manager?.name ?? "there"},</p>
        <p><strong>${ctx.employee.name}</strong> logged a ${payload.quarter ?? ""} check-in.</p>
        <p>${link}</p>`;
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

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("[notify] RESEND_API_KEY not set — skipping email");
    return { ok: false, reason: "no_api_key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[notify] resend failed", res.status, text);
    return { ok: false, reason: text };
  }
  return { ok: true };
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

  if (!payload?.event || !payload?.sheet_id || !payload?.actor_id) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look up sheet + employee + manager
  const { data: sheet, error: sheetErr } = await admin
    .from("goal_sheets")
    .select("id, employee_id, cycle_year")
    .eq("id", payload.sheet_id)
    .single();
  if (sheetErr || !sheet) {
    return new Response(
      JSON.stringify({ error: "sheet_not_found", detail: sheetErr?.message }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const { data: employee, error: empErr } = await admin
    .from("profiles")
    .select("id, full_name, email, manager_id")
    .eq("id", sheet.employee_id)
    .single();
  if (empErr || !employee) {
    return new Response(
      JSON.stringify({ error: "employee_not_found", detail: empErr?.message }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let manager: Recipient | null = null;
  if (employee.manager_id) {
    const { data: m } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", employee.manager_id)
      .single();
    if (m) manager = { name: m.full_name || m.email, email: m.email };
  }

  const ctx: Context = {
    employee: { name: employee.full_name || employee.email, email: employee.email },
    manager,
    sheetUrl: `${APP_BASE_URL}/employee/goals`,
    cycleYear: sheet.cycle_year,
  };

  // Recipient routing: employee actions → manager; manager actions → employee.
  const toEmployee = payload.event === "approved" || payload.event === "returned";
  const recipient = toEmployee ? ctx.employee : manager;

  if (!recipient?.email) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "no_recipient" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const subject = subjectFor(payload.event, ctx);
  const html = bodyHtml(payload.event, ctx, payload);
  const card = teamsCard(payload.event, ctx, payload);

  const [emailRes, teamsRes] = await Promise.all([
    sendEmail(recipient.email, subject, html),
    sendTeams(card),
  ]);

  return new Response(
    JSON.stringify({ ok: true, email: emailRes, teams: teamsRes }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
