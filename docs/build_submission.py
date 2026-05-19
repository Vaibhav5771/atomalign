"""Generate docs/SUBMISSION.pdf for AtomQuest Hackathon 1.0."""
from fpdf import FPDF
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "SUBMISSION.pdf"
DIAGRAM = ROOT / "context" / "architecture.png"

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 6, "AtomAlign — AtomQuest Hackathon 1.0 Submission · Vaibhav Satish Pardeshi",
                 align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")


def hr(pdf, color=(220, 220, 220)):
    pdf.set_draw_color(*color)
    x1 = pdf.l_margin
    x2 = pdf.w - pdf.r_margin
    y = pdf.get_y()
    pdf.line(x1, y, x2, y)
    pdf.ln(3)


def h1(pdf, text):
    pdf.set_font("DejaVu", "B", 18)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")


def h2(pdf, text):
    pdf.ln(2)
    pdf.set_font("DejaVu", "B", 13)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
    hr(pdf)


def body(pdf, text, size=10):
    pdf.set_font("DejaVu", "", size)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(0, 5.5, text, new_x="LMARGIN", new_y="NEXT")


def label_value(pdf, label, value, mono_value=False):
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(38, 6, label)
    if mono_value:
        pdf.set_font("DejaVuMono", "", 10)
    else:
        pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, value, new_x="LMARGIN", new_y="NEXT")


def bullet(pdf, text):
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(30, 41, 59)
    x_start = pdf.get_x()
    pdf.cell(5, 5.5, "•")
    pdf.multi_cell(0, 5.5, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(x_start)


def kv_table(pdf, rows, col1_w=70):
    inner_w = pdf.w - pdf.l_margin - pdf.r_margin
    col2_w = inner_w - col1_w
    pdf.set_font("DejaVu", "B", 9)
    pdf.set_fill_color(241, 245, 249)
    pdf.set_text_color(51, 65, 85)
    pdf.cell(col1_w, 7, "Requirement", border=0, fill=True)
    pdf.cell(col2_w, 7, "Implementation", border=0, fill=True, new_x="LMARGIN", new_y="NEXT")
    for left, right in rows:
        y0 = pdf.get_y()
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(15, 23, 42)
        x0 = pdf.get_x()
        pdf.multi_cell(col1_w, 5.2, left, border=0)
        y1 = pdf.get_y()
        pdf.set_xy(x0 + col1_w, y0)
        pdf.set_text_color(30, 41, 59)
        pdf.multi_cell(col2_w, 5.2, right, border=0)
        y2 = pdf.get_y()
        end_y = max(y1, y2)
        pdf.set_draw_color(226, 232, 240)
        pdf.line(pdf.l_margin, end_y + 0.5, pdf.l_margin + inner_w, end_y + 0.5)
        pdf.set_y(end_y + 1.5)


def main():
    pdf = PDF(format="A4", unit="mm")
    pdf.add_font("DejaVu", "", FONT_REG)
    pdf.add_font("DejaVu", "B", FONT_BOLD)
    pdf.add_font("DejaVuMono", "", FONT_MONO)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(left=18, top=15, right=18)

    # ============= PAGE 1 =============
    pdf.add_page()

    # Title block
    pdf.set_font("DejaVu", "B", 22)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 11, "AtomAlign", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 12)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 6, "In-House Goal Setting & Tracking Portal",
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "AtomQuest Hackathon 1.0 — Submission Document",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    hr(pdf, color=(15, 23, 42))

    # Submitter
    pdf.ln(1)
    label_value(pdf, "Submitter", "Vaibhav Satish Pardeshi")
    label_value(pdf, "Email", "vaibhavpardeshi190@gmail.com")
    label_value(pdf, "Phone", "+91 9923307579")
    label_value(pdf, "College", "MMCOE, Karve Nagar, Pune")
    label_value(pdf, "Submission date", "19 May 2026")

    # ----- Mandatory deliverables -----
    h2(pdf, "Submission Deliverables")

    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "Working live demo URL", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuMono", "", 10)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 6, "https://atomalignv.netlify.app", new_x="LMARGIN", new_y="NEXT",
             link="https://atomalignv.netlify.app")
    pdf.ln(2)

    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "Source code repository (GitHub)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuMono", "", 10)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 6, "https://github.com/Vaibhav5771/atomalign", new_x="LMARGIN", new_y="NEXT",
             link="https://github.com/Vaibhav5771/atomalign")
    pdf.ln(2)

    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "Demo credentials", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(0, 5.5,
        "Single pre-seeded admin login. Manager and Employee accounts are created "
        "by the reviewer through the onboarding wizard that auto-opens on first "
        "admin sign-in. Real email addresses can be used so welcome emails and "
        "goal-event notifications land in inboxes the reviewer can read.",
        new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("DejaVuMono", "", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.set_fill_color(254, 249, 195)
    pdf.cell(38, 6, "  Email:", fill=True)
    pdf.cell(0, 6, "  admin@demo.com", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(38, 6, "  Password:", fill=True)
    pdf.cell(0, 6, "  Demo@1234", fill=True, new_x="LMARGIN", new_y="NEXT")

    # ----- Architecture diagram -----
    h2(pdf, "Architecture Diagram")
    page_w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.image(str(DIAGRAM), x=pdf.l_margin, w=page_w)
    pdf.ln(1)
    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(0, 4.5,
        "Three-layer architecture: users (Employee / Manager / Admin) -> Netlify-hosted "
        "React SPA -> Supabase (Postgres + Auth + Edge Functions). Source SVG: "
        "context/architecture.svg.",
        new_x="LMARGIN", new_y="NEXT")

    # ============= PAGE 2 =============
    pdf.add_page()

    h2(pdf, "Technology Stack")
    body(pdf,
         "Frontend:   React 19 · Vite · TypeScript · Tailwind CSS · shadcn/ui · Recharts · Magic UI\n"
         "Hosting:    Netlify (static SPA, CDN edge)\n"
         "Backend:    Supabase — managed Postgres + Auth + Edge Functions (Deno)\n"
         "Auth:       Email/password + Microsoft Entra ID SSO\n"
         "Email:      Gmail SMTP via Supabase Edge Function (denomailer)\n"
         "Security:   Row Level Security on every table; SECURITY DEFINER only for admin RPCs\n"
         "Infra cost: ~$0/month (Supabase free tier + Netlify free tier)")

    h2(pdf, "BRD Coverage")
    kv_table(pdf, [
        ("Phase 1 — Goal creation, UoM, weightage rules",
         "Goal sheet with Thrust Area, UoM (Numeric / %  / Timeline / Zero), targets, "
         "weightage. Validation: 100% sum, 10% min per goal, 8-goal cap (DB triggers + client zod)."),
        ("Phase 1 — Manager approval workflow",
         "Inline edit during review · Approve (locks sheet) · Return for rework · "
         "Admin can reopen approved sheets."),
        ("Phase 1 — Shared goals",
         "Admin pushes a KPI to many employees; recipients adjust weightage only; "
         "title/target read-only; achievements sync from primary owner."),
        ("Phase 2 — Quarterly check-ins",
         "Planned vs. actual per goal · status (Not Started / On Track / Completed) · "
         "system-computed UoM scores (Min / Max / Timeline / Zero)."),
        ("Phase 2 — Manager check-in",
         "Per-employee planned-vs-actual view + structured comment per goal."),
        ("Section 2.3 — Quarterly window enforcement",
         "CyclePhaseBanner on both employee and manager check-in pages; shows current open "
         "window (May / Jul / Oct / Jan / Mar-Apr) and when the next opens."),
        ("Section 3 — Three roles with isolation",
         "Employee / Manager / Admin with role-based routing and Postgres RLS policies."),
        ("Section 4 — Reporting and governance",
         "Achievement export (CSV / XLSX), real-time completion dashboard, "
         "post-lock audit trail."),
        ("Bonus 5.1 — Microsoft Entra ID SSO",
         "Live · Graph /me org-hierarchy sync · MS sign-in restricted to admin-pre-registered emails."),
        ("Bonus 5.2 — Email & Teams notifications",
         "Email live via Gmail SMTP for 5 events (submitted / approved / returned / "
         "check-in saved / user_created). Teams adaptive card code-ready."),
        ("Bonus 5.3 — Rule-based escalation",
         "EscalationsPage + scheduled evaluate-escalations Edge Function. "
         "3-step SUBMIT_OVERDUE chain seeded. Escalation log visible to admin."),
        ("Bonus 5.4 — Analytics",
         "QoQ trends · goal distribution · team completion heatmap · manager effectiveness."),
    ], col1_w=72)

    h2(pdf, "5-Minute Happy-Path Walkthrough")
    bullet(pdf, "Sign in as admin@demo.com / Demo@1234. The Create-Team wizard auto-opens.")
    bullet(pdf, "Wizard Step 0: create a personal admin with your own email (admin@demo.com stays as fallback).")
    bullet(pdf, "Wizard Steps 1–2: add 1 manager + 1 employee using real email addresses.")
    bullet(pdf, "Sign in as the new employee → /employee/goals/new → create 2 goals (60/40 weightage) → submit.")
    bullet(pdf, "Sign in as the manager → review the submission → tweak one target inline → approve.")
    bullet(pdf, "Sign back in as the employee → /employee/checkins → log a Q1 actual.")
    bullet(pdf, "Manager opens /manager/checkins → reads the actual → adds a check-in comment.")
    bullet(pdf, "Admin opens /admin/analytics, /admin/reports (export XLSX), /admin/users — full loop complete.")

    h2(pdf, "Notes for Evaluators")
    bullet(pdf, "Confirm-email is OFF in Supabase Auth so admin-created users sign in immediately.")
    bullet(pdf, "First-tier Supabase + Netlify free — total infra cost is effectively zero.")
    bullet(pdf, "12 sequential SQL migrations are committed under supabase/migrations/ (version-controlled schema).")
    bullet(pdf, "Live site auto-redeploys on push to main via Netlify.")
    bullet(pdf, "Detailed credentials walkthrough + Microsoft sign-in caveat in repo: context/demo-credentials.md.")

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
