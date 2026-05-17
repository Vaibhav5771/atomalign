// Supabase Edge Function: evaluate-escalations
//
// Scans for overdue goal-lifecycle items per the active escalation_rules,
// inserts escalation log rows (deduped by daily uniqueness), and invokes the
// existing `notify` function with event="escalation" for each fired row.
//
// Invoked by:
//   - Supabase Cron daily 09:00 (production)
//   - Admin "Run now" button (demo)
//
// Returns: { ok, evaluated_rules, fired, skipped_duplicates }

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type TriggerType = "SUBMIT_OVERDUE" | "APPROVE_OVERDUE" | "CHECKIN_OVERDUE";
type EscalateTarget = "EMPLOYEE" | "MANAGER" | "SKIP_LEVEL" | "HR";

interface Rule {
  id: string;
  name: string;
  trigger_type: TriggerType;
  threshold_days: number;
  escalate_to: EscalateTarget;
}

interface OverdueRow {
  subject_user_id: string;
  sheet_id: string | null;
  reason_text: string;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function findOverdue(admin: any, rule: Rule): Promise<OverdueRow[]> {
  const cutoff = isoDaysAgo(rule.threshold_days);

  if (rule.trigger_type === "SUBMIT_OVERDUE") {
    const { data } = await admin
      .from("goal_sheets")
      .select("id, employee_id, cycle_year, created_at")
      .in("status", ["DRAFT", "RETURNED"])
      .lt("created_at", cutoff);
    return (data ?? []).map((s: any) => ({
      subject_user_id: s.employee_id,
      sheet_id: s.id,
      reason_text: `Goal sheet for ${s.cycle_year} is still ${
        s.status ?? "DRAFT"
      } — open for ${rule.threshold_days}+ days without submission.`,
    }));
  }

  if (rule.trigger_type === "APPROVE_OVERDUE") {
    const { data } = await admin
      .from("goal_sheets")
      .select("id, employee_id, cycle_year, submitted_at")
      .eq("status", "SUBMITTED")
      .lt("submitted_at", cutoff);
    return (data ?? []).map((s: any) => ({
      subject_user_id: s.employee_id,
      sheet_id: s.id,
      reason_text: `Goal sheet for ${s.cycle_year} has been awaiting approval for ${rule.threshold_days}+ days.`,
    }));
  }

  if (rule.trigger_type === "CHECKIN_OVERDUE") {
    // APPROVED sheets approved more than threshold_days ago, with at least one
    // goal that has zero check_ins recorded.
    const { data: sheets } = await admin
      .from("goal_sheets")
      .select(
        "id, employee_id, cycle_year, approved_at, goals(id, check_ins(id))",
      )
      .eq("status", "APPROVED")
      .lt("approved_at", cutoff);

    const overdue: OverdueRow[] = [];
    for (const s of (sheets ?? []) as any[]) {
      const goalsWithoutCheckins = (s.goals ?? []).filter(
        (g: any) => !g.check_ins || g.check_ins.length === 0,
      );
      if (goalsWithoutCheckins.length > 0) {
        overdue.push({
          subject_user_id: s.employee_id,
          sheet_id: s.id,
          reason_text: `${goalsWithoutCheckins.length} goal(s) on the ${s.cycle_year} sheet have no check-ins recorded.`,
        });
      }
    }
    return overdue;
  }

  return [];
}

async function resolveRecipient(
  admin: any,
  subjectUserId: string,
  target: EscalateTarget,
): Promise<string | null> {
  if (target === "EMPLOYEE") return subjectUserId;

  const { data: subject } = await admin
    .from("profiles")
    .select("id, manager_id")
    .eq("id", subjectUserId)
    .single();
  if (!subject) return null;

  if (target === "MANAGER") return subject.manager_id ?? null;

  if (target === "SKIP_LEVEL") {
    if (!subject.manager_id) return null;
    const { data: mgr } = await admin
      .from("profiles")
      .select("manager_id")
      .eq("id", subject.manager_id)
      .single();
    return mgr?.manager_id ?? null;
  }

  if (target === "HR") {
    // Use any ADMIN as HR proxy
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "ADMIN")
      .limit(1);
    return admins?.[0]?.id ?? null;
  }

  return null;
}

async function callNotify(
  escalation: {
    id: string;
    subject_user_id: string;
    recipient_user_id: string;
    sheet_id: string | null;
    reason_text: string;
  },
  callerAuth: string,
): Promise<void> {
  // Forward the original caller's Authorization header (the admin's user JWT
  // when invoked from the "Run now" button) so notify's verify_jwt gateway
  // accepts the request. Falls back to anon key for cron-scheduled runs.
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: callerAuth,
      },
      body: JSON.stringify({
        event: "escalation",
        actor_id: escalation.subject_user_id,
        recipient_id: escalation.recipient_user_id,
        sheet_id: escalation.sheet_id ?? undefined,
        remark: escalation.reason_text,
      }),
    });
  } catch (e) {
    console.warn("[evaluate-escalations] notify invoke failed", e);
  }
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

  // Capture the original caller's Authorization header so we can forward it
  // to notify (whose verify_jwt gateway requires a valid user JWT). The SDK
  // call from the browser's "Run now" button automatically includes this.
  const callerAuth =
    req.headers.get("Authorization") ?? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rules, error: rulesErr } = await admin
    .from("escalation_rules")
    .select("id, name, trigger_type, threshold_days, escalate_to")
    .eq("is_active", true);

  if (rulesErr) {
    return new Response(
      JSON.stringify({ ok: false, error: rulesErr.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let fired = 0;
  let skipped = 0;
  const evaluatedRules = (rules ?? []).length;

  for (const rule of (rules ?? []) as Rule[]) {
    const overdueRows = await findOverdue(admin, rule);

    for (const row of overdueRows) {
      const recipientId = await resolveRecipient(
        admin,
        row.subject_user_id,
        rule.escalate_to,
      );
      if (!recipientId) {
        // No one to chase — skip silently. e.g. SKIP_LEVEL when there's no
        // manager chain, or HR target when no admin exists.
        continue;
      }

      // Insert escalation row. The unique index on (rule_id, subject, fire_date)
      // makes this idempotent — re-runs the same day skip via 23505.
      const { data: inserted, error: insErr } = await admin
        .from("escalations")
        .insert({
          rule_id: rule.id,
          subject_user_id: row.subject_user_id,
          recipient_user_id: recipientId,
          trigger_type: rule.trigger_type,
          sheet_id: row.sheet_id,
          reason_text: row.reason_text,
        })
        .select("id, subject_user_id, recipient_user_id, sheet_id, reason_text")
        .single();

      if (insErr) {
        // 23505 = unique_violation → already fired today
        if (insErr.code === "23505") {
          skipped++;
          continue;
        }
        console.warn("[evaluate-escalations] insert failed", insErr);
        continue;
      }

      fired++;
      await callNotify(inserted, callerAuth);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      evaluated_rules: evaluatedRules,
      fired,
      skipped_duplicates: skipped,
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
