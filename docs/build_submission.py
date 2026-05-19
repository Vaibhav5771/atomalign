"""Generate docs/SUBMISSION.pdf for AtomQuest Hackathon 1.0.

Single-page submission containing ONLY the three items asked for in the brief:
  1. Working live demo URL
  2. Source code repository
  3. Architecture diagram

Submitter identification block is kept minimal at the top so the form-receiver
can attribute the document.
"""
from fpdf import FPDF
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "SUBMISSION.pdf"
DIAGRAM = ROOT / "context" / "architecture.png"

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def hr(pdf, color=(220, 220, 220)):
    pdf.set_draw_color(*color)
    x1 = pdf.l_margin
    x2 = pdf.w - pdf.r_margin
    y = pdf.get_y()
    pdf.line(x1, y, x2, y)
    pdf.ln(3)


def main():
    pdf = FPDF(format="A4", unit="mm")
    pdf.add_font("DejaVu", "", FONT_REG)
    pdf.add_font("DejaVu", "B", FONT_BOLD)
    pdf.add_font("DejaVuMono", "", FONT_MONO)
    pdf.set_auto_page_break(auto=False)
    pdf.set_margins(left=18, top=15, right=18)

    pdf.add_page()
    page_w = pdf.w - pdf.l_margin - pdf.r_margin

    # ---------------- Title ----------------
    pdf.set_font("DejaVu", "B", 22)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 11, "AtomAlign", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("DejaVu", "", 11)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 6,
             "In-House Goal Setting & Tracking Portal  ·  AtomQuest Hackathon 1.0 Submission",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    hr(pdf, color=(15, 23, 42))
    pdf.ln(4)

    # ---------------- Item 1: Working link ----------------
    pdf.set_font("DejaVu", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "1.  Working live demo URL", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuMono", "", 11)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 7, "    https://atomalignv.netlify.app",
             new_x="LMARGIN", new_y="NEXT",
             link="https://atomalignv.netlify.app")
    pdf.ln(3)

    # ---------------- Item 2: Source code repo ----------------
    pdf.set_font("DejaVu", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "2.  Source code repository (GitHub)",
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuMono", "", 11)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(0, 7, "    https://github.com/Vaibhav5771/atomalign",
             new_x="LMARGIN", new_y="NEXT",
             link="https://github.com/Vaibhav5771/atomalign")
    pdf.ln(3)

    # ---------------- Item 3: Architecture diagram ----------------
    pdf.set_font("DejaVu", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "3.  Architecture diagram",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # Diagram: 4:3 aspect at 1280x960. Width 170mm -> height ~127mm.
    diagram_w = 170
    x_centered = pdf.l_margin + (page_w - diagram_w) / 2
    pdf.image(str(DIAGRAM), x=x_centered, w=diagram_w)

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
