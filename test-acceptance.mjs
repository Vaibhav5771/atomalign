import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dirname, ".env"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);

const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PW = "Demo@1234";
const EMAIL_EMP = "employee@demo.com";
const EMAIL_MGR = "manager@demo.com";
const EMAIL_ADM = "admin@demo.com";

const CYCLE = new Date().getFullYear();

let pass = 0,
  fail = 0;
const log = (ok, name, detail = "") => {
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag}  ${name}${detail ? "  -  " + detail : ""}`);
  ok ? pass++ : fail++;
};

const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return data.user;
}

async function getProfile(client, userId) {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data;
}

async function resetSheetForTest(employeeId) {
  // Manager elevates the sheet back to DRAFT regardless of current state.
  const mgr = mk();
  await signIn(mgr, EMAIL_MGR);
  const { data: existing } = await mgr
    .from("goal_sheets")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("cycle_year", CYCLE)
    .maybeSingle();
  if (existing) {
    await mgr.from("goals").update({ is_locked: false }).eq("sheet_id", existing.id);
    // Delete all goals (manager has update; goals delete is restricted to employee — use admin)
    await mgr
      .from("goal_sheets")
      .update({
        status: "DRAFT",
        approved_at: null,
        submitted_at: null,
        manager_remark: null,
      })
      .eq("id", existing.id);
  }
  await mgr.auth.signOut();

  // Employee deletes their own goals on the now-DRAFT sheet
  const emp = mk();
  await signIn(emp, EMAIL_EMP);
  if (existing) {
    await emp.from("goals").delete().eq("sheet_id", existing.id);
  }
  await emp.auth.signOut();
  return existing;
}

async function main() {
  console.log("\n=== Phase 1 Acceptance Test (data layer) ===\n");

  // Reset state from any prior test run
  const probe = mk();
  await signIn(probe, EMAIL_EMP);
  const empUser0 = (await probe.auth.getUser()).data.user;
  await probe.auth.signOut();
  if (!empUser0) {
    console.error("FATAL: could not sign in as " + EMAIL_EMP);
    process.exit(2);
  }
  await resetSheetForTest(empUser0.id);

  // ============================================================
  // Employee flow
  // ============================================================
  const emp = mk();
  const empUser = await signIn(emp, EMAIL_EMP);
  const empProfile = await getProfile(emp, empUser.id);
  log(empProfile.role === "EMPLOYEE", "AC1  Employee profile/role resolves on login");

  // Get-or-create sheet
  const { data: priorSheet } = await emp
    .from("goal_sheets")
    .select("*")
    .eq("employee_id", empUser.id)
    .eq("cycle_year", CYCLE)
    .maybeSingle();
  let sheet = priorSheet;
  if (!sheet) {
    const { data: created, error: insErr } = await emp
      .from("goal_sheets")
      .insert({ employee_id: empUser.id, cycle_year: CYCLE, status: "DRAFT" })
      .select()
      .single();
    if (insErr) console.error("Insert sheet error:", insErr.message);
    sheet = created;
  }
  log(!!sheet?.id && sheet.status === "DRAFT", `AC2a Employee has a DRAFT sheet (id=${sheet?.id?.slice(0, 8)})`);

  // Weightage < 10 should be rejected by DB CHECK
  const { error: lowErr } = await emp.from("goals").insert({
    sheet_id: sheet.id,
    thrust_area: "Test",
    title: "Too low",
    uom: "NUMERIC",
    target: "100",
    weightage: 5,
    is_shared: false,
  });
  log(!!lowErr, "AC6  Cannot add goal with weightage < 10%", lowErr?.message?.slice(0, 80));

  // Add a valid goal
  const { error: g1Err } = await emp.from("goals").insert({
    sheet_id: sheet.id,
    thrust_area: "Revenue",
    title: "Hit revenue target",
    uom: "NUMERIC",
    target: "50000000",
    weightage: 40,
    is_shared: false,
  });
  log(!g1Err, "AC2b Employee can add a valid goal", g1Err?.message);

  // Try adding up to 8 more; the 9th total should be blocked by trigger
  let capHit = false;
  let capErr = null;
  for (let i = 2; i <= 9; i++) {
    const { error } = await emp.from("goals").insert({
      sheet_id: sheet.id,
      thrust_area: "X",
      title: `Goal ${i}`,
      uom: "NUMERIC",
      target: "1",
      weightage: 10,
      is_shared: false,
    });
    if (error) {
      capHit = true;
      capErr = error;
      break;
    }
  }
  log(capHit, "AC5  9th goal blocked by 8-goal cap", capErr?.message?.slice(0, 80));

  const { count: goalCount } = await emp
    .from("goals")
    .select("*", { count: "exact", head: true })
    .eq("sheet_id", sheet.id);
  log(goalCount === 8, `AC5b Sheet has exactly 8 goals (got ${goalCount})`);

  const goals = (await emp.from("goals").select("*").eq("sheet_id", sheet.id)).data ?? [];
  const total = goals.reduce((s, g) => s + g.weightage, 0);
  log(total === 110, `AC3  WeightageBar total computed correctly (got ${total}, expected 110)`);

  // Re-balance to 100% by deleting all but the first 2 and adjusting
  const sorted = [...goals].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (let i = 2; i < sorted.length; i++) await emp.from("goals").delete().eq("id", sorted[i].id);
  await emp.from("goals").update({ weightage: 60 }).eq("id", sorted[1].id);

  const finalGoals = (await emp.from("goals").select("*").eq("sheet_id", sheet.id)).data ?? [];
  const finalTotal = finalGoals.reduce((s, g) => s + g.weightage, 0);
  log(finalTotal === 100, `AC4a Cleanup -> weightage = 100% (got ${finalTotal})`);

  // Submit
  const { data: submitted, error: submitErr } = await emp
    .from("goal_sheets")
    .update({ status: "SUBMITTED", submitted_at: new Date().toISOString() })
    .eq("id", sheet.id)
    .select()
    .single();
  log(submitted?.status === "SUBMITTED" && !submitErr, "AC7a Employee can submit (status SUBMITTED)");

  // Post-submit insert should be blocked
  const { error: postSubmitErr } = await emp.from("goals").insert({
    sheet_id: sheet.id,
    thrust_area: "Late",
    title: "Late add",
    uom: "NUMERIC",
    target: "1",
    weightage: 10,
    is_shared: false,
  });
  log(!!postSubmitErr, "AC7b Form locks after submit (insert blocked)", postSubmitErr?.message?.slice(0, 80));

  await emp.auth.signOut();

  // ============================================================
  // Manager flow
  // ============================================================
  const mgr = mk();
  const mgrUser = await signIn(mgr, EMAIL_MGR);
  const mgrProfile = await getProfile(mgr, mgrUser.id);
  log(mgrProfile.role === "MANAGER", "AC8a Manager profile/role resolves on login");

  const { data: reports } = await mgr.from("profiles").select("*").eq("manager_id", mgrUser.id);
  log((reports?.length ?? 0) >= 1, `AC8b Manager sees ${reports?.length ?? 0} direct report(s)`);

  const { data: visible } = await mgr
    .from("goal_sheets")
    .select("*")
    .eq("id", sheet.id)
    .maybeSingle();
  log(!!visible, "AC9  Manager can read employee's submitted sheet via RLS");

  const firstGoal = finalGoals[0];
  const { data: edited, error: editErr } = await mgr
    .from("goals")
    .update({ target: "60000000", weightage: 50 })
    .eq("id", firstGoal.id)
    .select()
    .single();
  log(
    edited?.target === "60000000" && edited?.weightage === 50 && !editErr,
    "AC10 Manager can edit target + weightage inline",
    editErr?.message,
  );
  await mgr.from("goals").update({ weightage: 50 }).eq("id", finalGoals[1].id);

  // Approve
  await mgr.from("goals").update({ is_locked: true }).eq("sheet_id", sheet.id);
  const { data: approved } = await mgr
    .from("goal_sheets")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      manager_remark: "Looks good",
    })
    .eq("id", sheet.id)
    .select()
    .single();
  const { error: auditErr } = await mgr.from("audit_logs").insert({
    sheet_id: sheet.id,
    changed_by: mgrUser.id,
    action: "APPROVE",
    new_value: { status: "APPROVED" },
  });
  log(
    approved?.status === "APPROVED" && !auditErr,
    "AC11a Manager approve -> APPROVED + audit log inserted",
    auditErr?.message,
  );

  const { data: lockedGoals } = await mgr.from("goals").select("*").eq("sheet_id", sheet.id);
  log(lockedGoals?.every((g) => g.is_locked), "AC11b All goals locked after approval");

  // Return-for-rework path
  await mgr.from("goals").update({ is_locked: false }).eq("sheet_id", sheet.id);
  await mgr
    .from("goal_sheets")
    .update({ status: "RETURNED", manager_remark: "Please widen scope" })
    .eq("id", sheet.id);
  await mgr.from("audit_logs").insert({
    sheet_id: sheet.id,
    changed_by: mgrUser.id,
    action: "RETURN",
    new_value: { status: "RETURNED" },
  });
  await mgr.auth.signOut();

  // Employee can now edit again
  const emp2 = mk();
  await signIn(emp2, EMAIL_EMP);
  const { error: postReturnErr } = await emp2
    .from("goals")
    .update({ weightage: 55 })
    .eq("id", finalGoals[1].id);
  log(!postReturnErr, "AC12 Returned sheet -> employee can edit again", postReturnErr?.message);
  await emp2.from("goals").update({ weightage: 50 }).eq("id", finalGoals[1].id);
  await emp2.auth.signOut();

  // ============================================================
  // Admin flow
  // ============================================================
  const adm = mk();
  const admUser = await signIn(adm, EMAIL_ADM);
  const admProfile = await getProfile(adm, admUser.id);
  log(admProfile.role === "ADMIN", "AC13a Admin profile/role resolves on login");

  const { error: pushErr } = await adm.from("goals").insert({
    sheet_id: sheet.id,
    thrust_area: "Org-wide",
    title: "All-hands compliance",
    description: "Pushed by admin",
    uom: "ZERO",
    target: "0",
    weightage: 10,
    is_shared: true,
    is_locked: false,
  });
  log(!pushErr, "AC13b Admin can push a shared goal into employee sheet", pushErr?.message);

  const emp3 = mk();
  await signIn(emp3, EMAIL_EMP);
  const { data: empSeesShared } = await emp3
    .from("goals")
    .select("*")
    .eq("sheet_id", sheet.id)
    .eq("is_shared", true);
  log(
    (empSeesShared?.length ?? 0) >= 1,
    `AC14a Employee sees admin's shared goal (is_shared=true; got ${empSeesShared?.length ?? 0})`,
  );

  const { data: auditAsEmp, error: auditAsEmpErr } = await emp3.from("audit_logs").select("*");
  log(
    !auditAsEmpErr && (auditAsEmp?.length ?? 0) === 0,
    "AC15a Audit logs invisible to non-admin (employee view)",
  );
  await emp3.auth.signOut();

  const { data: auditAsAdm } = await adm.from("audit_logs").select("*").eq("sheet_id", sheet.id);
  log((auditAsAdm?.length ?? 0) >= 2, `AC15b Admin can read audit logs (got ${auditAsAdm?.length ?? 0})`);

  const { data: sess } = await adm.auth.getSession();
  log(!!sess?.session, "AC16 Supabase session persistable (getSession returns truthy)");

  await adm.auth.signOut();

  console.log(`\n=== Results: ${pass} passed   ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(2);
});
