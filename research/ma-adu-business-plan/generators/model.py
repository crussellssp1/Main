"""Massachusetts ADU project model — JS SSP house style."""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName

# ---- House style tokens -----------------------------------------------------
NAVY   = "FF0F2F51"
LTBLUE = "FFD9E1F2"
LTGRAY = "FFF2F2F2"
LTRED  = "FFF2DCDB"
LTGRN  = "FFE2EFDA"

GREEN  = "FF008000"   # hardcoded input on this sheet
BLUE   = "FF0000FF"   # link to another cell or sheet
PURPLE = "FF800080"   # hardcode carried in from another schedule
BLACK  = "FF000000"   # calculated on this sheet

CUR = '$#,##0;($#,##0);-'          # JS SSP Currency
NUM = '#,##0;(#,##0);"-"'          # JS SSP Number
PCT = '0.0%;(0.0%);-'              # JS SSP Percent
PSF = '"$"#,##0;("$"#,##0);"-"'
RAT = '0.00"x"'
YRS = '0.0"x"'

F10   = dict(name="Calibri", size=10)
dotted = Side(style="dotted", color="FF808080")
INPUT_BORDER = Border(left=dotted, right=dotted, top=dotted, bottom=dotted)
thin_top = Border(top=Side(style="thin", color="FF0F2F51"))
dash = Side(style="dashed", color="FF0F2F51")
BASE_BOX = Border(left=dash, right=dash, top=dash, bottom=dash)

wb = openpyxl.Workbook()

def style(ws, ref, *, font_color=BLACK, bold=False, fill=None, fmt=None,
          align=None, border=None, italic=False, size=10):
    cell = ws[ref]
    cell.font = Font(name="Calibri", size=size, bold=bold, italic=italic,
                     color=font_color)
    if fill:
        cell.fill = PatternFill("solid", fgColor=fill)
    if fmt:
        cell.number_format = fmt
    if align:
        cell.alignment = Alignment(horizontal=align, vertical="center")
    if border:
        cell.border = border
    return cell

def band(ws, row, first, last, text):
    """Navy header band. Spanned with centerContinuous, never merged."""
    ws.cell(row=row, column=first).value = text
    for c in range(first, last + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = PatternFill("solid", fgColor=NAVY)
        cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFFFF")
        cell.alignment = Alignment(horizontal="centerContinuous", vertical="center")
    ws.row_dimensions[row].height = 16

def subhead(ws, row, first, last, labels):
    for i, t in enumerate(labels):
        cell = ws.cell(row=row, column=first + i)
        cell.value = t
        cell.fill = PatternFill("solid", fgColor=LTBLUE)
        cell.font = Font(name="Calibri", size=10, bold=True, color=BLACK)
        cell.alignment = Alignment(horizontal="left" if i == 0 else "center",
                                   vertical="center")

def banding(ws, row, first, last):
    for c in range(first, last + 1):
        ws.cell(row=row, column=c).fill = PatternFill("solid", fgColor=LTGRAY)

def names(wb, sheet, mapping):
    for nm, ref in mapping.items():
        wb.defined_names.add(DefinedName(nm, attr_text=f"'{sheet}'!{ref}"))

# =============================================================================
# 1. ASSUMPTIONS
# =============================================================================
a = wb.active
a.title = "Assumptions"
a.sheet_view.showGridLines = False
a.column_dimensions["A"].width = 2
a.column_dimensions["B"].width = 52
a.column_dimensions["C"].width = 14
a.column_dimensions["D"].width = 2
a.column_dimensions["E"].width = 58

band(a, 1, 2, 5, "MASSACHUSETTS ADU PROJECT MODEL  |  ASSUMPTIONS")
style(a, "B2", font_color="FF808080", italic=True, size=9)
a["B2"] = "All green cells are inputs. Blue is a link, black is a formula. Figures are illustrative and require validation."

r = 4
inputs = [
    ("UNIT AND COST", None, None, None),
    ("Unit size", 900, NUM, "Unit_SF"),
    ("Hard cost per sq ft: foundation, shell, systems, interior", 333.33, PSF, "HardCost_PSF"),
    ("Utility service, laterals and trenching", 18000, CUR, "Utility_Cost"),
    ("Site work, access and restoration", 12000, CUR, "Site_Cost"),
    ("Design, structural engineering and survey", 16000, CUR, "Design_Cost"),
    ("Permits and municipal fees", 6000, CUR, "Permit_Cost"),
    ("Contingency, percent of hard cost", 0.08, PCT, "Contingency_Pct"),
    ("Wastewater system if the lot is not sewered, net of grants", 35000, CUR, "Septic_Cost"),
    ("Lot is sewered: enter 1 for yes, 0 for no", 1, NUM, "Sewered_Flag"),
    ("REVENUE AND OPERATING", None, None, None),
    ("Monthly rent achievable on the ADU", 3400, CUR, "Rent_ADU_Mo"),
    ("Monthly rent on the main house, downsize case", 4007, CUR, "Rent_House_Mo"),
    ("Operating expense ratio: tax uplift, insurance, maintenance, vacancy", 0.30, PCT, "Opex_Pct"),
    ("FINANCING", None, None, None),
    ("MassHousing ADU construction loan, detached maximum", 250000, CUR, "MH_Loan"),
    ("MassHousing assumed interest rate", 0.065, PCT, "MH_Rate"),
    ("MassHousing amortisation period, years", 20, NUM, "MH_Term"),
    ("Home Modification Loan Program, 0 percent, deferred to sale", 50000, CUR, "HMLP_Loan"),
    ("ELDERCARE COMPARISON", None, None, None),
    ("Assisted living per month, low", 7250, CUR, "AL_Low"),
    ("Assisted living per month, median", 8400, CUR, "AL_Med"),
    ("Assisted living per month, Greater Boston", 9600, CUR, "AL_High"),
    ("COMPANY", None, None, None),
    ("Gross margin on the design build contract", 0.20, PCT, "GM_Pct"),
    ("Permitting and financing coordination fee per unit", 8000, CUR, "Coord_Fee"),
    ("Fixed overhead, year one", 450000, CUR, "Overhead_Y1"),
    ("Target unlevered yield hurdle", 0.065, PCT, "Hurdle"),
]
name_map = {}
shade = False
for label, val, fmt, nm in inputs:
    if val is None:
        band(a, r, 2, 3, label)
        shade = False
        r += 1
        continue
    a.cell(row=r, column=2).value = label
    style(a, f"B{r}", font_color=BLACK)
    a.cell(row=r, column=3).value = val
    style(a, f"C{r}", font_color=GREEN, fmt=fmt, align="center", border=INPUT_BORDER)
    if shade:
        a.cell(row=r, column=2).fill = PatternFill("solid", fgColor=LTGRAY)
    shade = not shade
    name_map[nm] = f"$C${r}"
    r += 1

names(wb, "Assumptions", name_map)

# Source notes
r += 1
style(a, f"B{r}", font_color="FF808080", italic=True, size=9)
a.cell(row=r, column=2).value = (
    "Sources: Massachusetts contractor cost guides 2026; MassHousing; CEDAC Home Modification Loan Program; "
    "CareScout and Genworth Cost of Care; RentCafe and Zumper. All figures illustrative."
)

# =============================================================================
# 2. PROJECT
# =============================================================================
p = wb.create_sheet("Project")
p.sheet_view.showGridLines = False
p.column_dimensions["A"].width = 2
p.column_dimensions["B"].width = 52
for col in "CDE":
    p.column_dimensions[col].width = 15

band(p, 1, 2, 5, "SINGLE PROJECT ECONOMICS  |  900 SQ FT DETACHED TWO BEDROOM")

# --- Cost build
row = 3
band(p, row, 2, 5, "COST BUILD"); row += 1
subhead(p, row, 2, 5, ["Cost line", "Amount", "$ per sq ft", "% of total"]); row += 1
cost_start = row

cost_rows = [
    ("Hard cost: foundation, shell, systems and interior", "=Unit_SF*HardCost_PSF", BLACK),
    ("Utility service, laterals and trenching", "=Utility_Cost", BLUE),
    ("Site work, access and restoration", "=Site_Cost", BLUE),
    ("Design, structural engineering and survey", "=Design_Cost", BLUE),
    ("Permits and municipal fees", "=Permit_Cost", BLUE),
    ("Wastewater system, unsewered lots only", "=IF(Sewered_Flag=1,0,Septic_Cost)", BLACK),
    ("Contingency on hard cost", f"=C{cost_start}*Contingency_Pct", BLACK),
]
for i, (label, formula, fc) in enumerate(cost_rows):
    p.cell(row=row, column=2).value = label
    style(p, f"B{row}")
    p.cell(row=row, column=3).value = formula
    style(p, f"C{row}", font_color=fc, fmt=CUR, align="center")
    p.cell(row=row, column=4).value = f"=C{row}/Unit_SF"
    style(p, f"D{row}", fmt=PSF, align="center")
    p.cell(row=row, column=5).value = f"=C{row}/$C${cost_start+len(cost_rows)}"
    style(p, f"E{row}", fmt=PCT, align="center")
    if i % 2 == 0:
        banding(p, row, 2, 5)
    row += 1

total_row = row
p.cell(row=row, column=2).value = "Total all in project cost"
p.cell(row=row, column=3).value = f"=SUM(C{cost_start}:C{row-1})"
p.cell(row=row, column=4).value = f"=C{row}/Unit_SF"
p.cell(row=row, column=5).value = f"=C{row}/$C${row}"
for c, fmt in ((2, None), (3, CUR), (4, PSF), (5, PCT)):
    style(p, f"{get_column_letter(c)}{row}", font_color="FFFFFFFF", bold=True,
          fill=NAVY, fmt=fmt, align="left" if c == 2 else "center")
names(wb, "Project", {"Total_Cost": f"$C${total_row}"})
row += 2

# --- Sources and uses
band(p, row, 2, 5, "SOURCES AND USES, OWNER OCCUPANT"); row += 1
subhead(p, row, 2, 5, ["Source", "Amount", "% of total", "Terms"]); row += 1
src_start = row
p.column_dimensions["E"].width = 46
src = [
    ("MassHousing ADU construction loan", "=MIN(MH_Loan,Total_Cost)",
     "Fixed rate second mortgage, 20 year amortisation"),
    ("Home Modification Loan Program", f"=MIN(HMLP_Loan,MAX(0,Total_Cost-C{src_start}))",
     "0 percent, no monthly payment, deferred to sale"),
    ("Owner equity", f"=Total_Cost-C{src_start}-C{src_start+1}", "Cash at closing"),
]
for i, (label, formula, terms) in enumerate(src):
    p.cell(row=row, column=2).value = label
    style(p, f"B{row}")
    p.cell(row=row, column=3).value = formula
    style(p, f"C{row}", fmt=CUR, align="center")
    p.cell(row=row, column=4).value = f"=C{row}/Total_Cost"
    style(p, f"D{row}", fmt=PCT, align="center")
    p.cell(row=row, column=5).value = terms
    style(p, f"E{row}")
    if i % 2 == 0:
        banding(p, row, 2, 5)
    row += 1
eq_row = row - 1
names(wb, "Project", {"Owner_Equity": f"$C${eq_row}"})

p.cell(row=row, column=2).value = "Total sources"
p.cell(row=row, column=3).value = f"=SUM(C{src_start}:C{row-1})"
p.cell(row=row, column=4).value = f"=C{row}/Total_Cost"
for c, fmt in ((2, None), (3, CUR), (4, PCT), (5, None)):
    style(p, f"{get_column_letter(c)}{row}", font_color="FFFFFFFF", bold=True,
          fill=NAVY, fmt=fmt, align="left" if c in (2, 5) else "center")
row += 1
p.cell(row=row, column=2).value = "Check: sources less uses"
style(p, f"B{row}", italic=True, size=9, font_color="FF808080")
p.cell(row=row, column=3).value = f"=C{row-1}-Total_Cost"
style(p, f"C{row}", fmt=CUR, align="center", italic=True, size=9)
row += 2

# --- Segment returns
band(p, row, 2, 5, "SEGMENT RETURNS"); row += 1
subhead(p, row, 2, 5, ["Metric", "Eldercare", "Downsize in place", "Investor"]); row += 1
seg_start = row

seg = [
    ("Annual revenue or avoided cost", "=AL_Low*12", "=Rent_House_Mo*12", "=Rent_ADU_Mo*12", CUR),
    ("Operating expenses", "-", f"=-C{seg_start}*Opex_Pct", f"=-D{seg_start}*Opex_Pct", CUR),
]
# revenue row
p.cell(row=row, column=2).value = seg[0][0]
style(p, f"B{row}")
for j, f in enumerate(seg[0][1:4]):
    style(p, f"{get_column_letter(3+j)}{row}", fmt=CUR, align="center")
    p.cell(row=row, column=3 + j).value = f
banding(p, row, 2, 5)
rev_row = row; row += 1

p.cell(row=row, column=2).value = "Operating expenses"
style(p, f"B{row}")
p.cell(row=row, column=3).value = "-"
style(p, f"C{row}", fmt=CUR, align="center")
p.cell(row=row, column=4).value = f"=-D{rev_row}*Opex_Pct"
style(p, f"D{row}", fmt=CUR, align="center")
p.cell(row=row, column=5).value = f"=-E{rev_row}*Opex_Pct"
style(p, f"E{row}", fmt=CUR, align="center")
opex_row = row; row += 1

p.cell(row=row, column=2).value = "Net operating income"
style(p, f"B{row}", bold=True, border=thin_top)
p.cell(row=row, column=3).value = "-"
style(p, f"C{row}", fmt=CUR, align="center", bold=True, border=thin_top)
for j, col in enumerate("DE"):
    p.cell(row=row, column=4 + j).value = f"=SUM({col}{rev_row}:{col}{opex_row})"
    style(p, f"{col}{row}", fmt=CUR, align="center", bold=True, border=thin_top)
noi_row = row; row += 1

p.cell(row=row, column=2).value = "Unlevered yield on total cost"
style(p, f"B{row}")
p.cell(row=row, column=3).value = "-"
style(p, f"C{row}", fmt=PCT, align="center")
for col in "DE":
    p.cell(row=row, column=(4 if col == "D" else 5)).value = f"={col}{noi_row}/Total_Cost"
    style(p, f"{col}{row}", fmt=PCT, align="center")
banding(p, row, 2, 5)
row += 1

p.cell(row=row, column=2).value = "Years to break even against assisted living, low case"
style(p, f"B{row}")
p.cell(row=row, column=3).value = f"=Total_Cost/C{rev_row}"
style(p, f"C{row}", fmt=YRS, align="center")
for col in "DE":
    p.cell(row=row, column=(4 if col == "D" else 5)).value = "-"
    style(p, f"{col}{row}", fmt=YRS, align="center")
row += 1

p.cell(row=row, column=2).value = "Annual debt service on the MassHousing loan"
style(p, f"B{row}")
p.cell(row=row, column=3).value = "-"
style(p, f"C{row}", fmt=CUR, align="center")
p.cell(row=row, column=4).value = f"=PMT(MH_Rate/12,MH_Term*12,C{src_start})*12"
style(p, f"D{row}", fmt=CUR, align="center")
p.cell(row=row, column=5).value = "-"
style(p, f"E{row}", fmt=CUR, align="center")
banding(p, row, 2, 5)
ds_row = row; row += 1

p.cell(row=row, column=2).value = "Net cash flow after debt service"
style(p, f"B{row}", bold=True, border=thin_top)
p.cell(row=row, column=3).value = "-"
style(p, f"C{row}", fmt=CUR, align="center", bold=True, border=thin_top)
p.cell(row=row, column=4).value = f"=D{noi_row}+D{ds_row}"
style(p, f"D{row}", fmt=CUR, align="center", bold=True, border=thin_top)
p.cell(row=row, column=5).value = "-"
style(p, f"E{row}", fmt=CUR, align="center", bold=True, border=thin_top)
ncf_row = row; row += 1

p.cell(row=row, column=2).value = "Cash on cash return on owner equity"
style(p, f"B{row}")
p.cell(row=row, column=3).value = "-"
style(p, f"C{row}", fmt=PCT, align="center")
p.cell(row=row, column=4).value = f"=D{ncf_row}/Owner_Equity"
style(p, f"D{row}", fmt=PCT, align="center")
p.cell(row=row, column=5).value = "-"
style(p, f"E{row}", fmt=PCT, align="center")
banding(p, row, 2, 5)
row += 1

p.cell(row=row, column=2).value = "Rent required per month to clear the hurdle"
style(p, f"B{row}")
for col, cc in (("C", 3), ("D", 4)):
    p.cell(row=row, column=cc).value = "-"
    style(p, f"{col}{row}", fmt=CUR, align="center")
p.cell(row=row, column=5).value = "=Total_Cost*Hurdle/(1-Opex_Pct)/12"
style(p, f"E{row}", fmt=CUR, align="center", bold=True)
row += 2

# --- Company contribution
band(p, row, 2, 5, "CONTRIBUTION TO THE COMPANY"); row += 1
comp_start = row
comp = [
    ("Contract price to the owner", "=Total_Cost"),
    ("Gross margin on the contract", "=Total_Cost*GM_Pct"),
    ("Permitting and financing coordination fee", "=Coord_Fee"),
]
for i, (label, formula) in enumerate(comp):
    p.cell(row=row, column=2).value = label
    style(p, f"B{row}")
    p.cell(row=row, column=3).value = formula
    style(p, f"C{row}", font_color=BLUE if formula in ("=Coord_Fee",) else BLACK,
          fmt=CUR, align="center")
    if i % 2 == 0:
        banding(p, row, 2, 5)
    row += 1
p.cell(row=row, column=2).value = "Total contribution per unit"
p.cell(row=row, column=3).value = f"=SUM(C{comp_start+1}:C{row-1})"
for c, fmt in ((2, None), (3, CUR), (4, None), (5, None)):
    style(p, f"{get_column_letter(c)}{row}", font_color="FFFFFFFF", bold=True,
          fill=NAVY, fmt=fmt, align="left" if c == 2 else "center")
contrib_row = row
names(wb, "Project", {"Contribution": f"$C${contrib_row}"})
row += 1
p.cell(row=row, column=2).value = "Company breakeven volume, units per year"
style(p, f"B{row}", bold=True)
p.cell(row=row, column=3).value = "=Overhead_Y1/Contribution"
style(p, f"C{row}", fmt=RAT, align="center", bold=True)
row += 2
p.cell(row=row, column=2).value = (
    "Note: operating expenses are presented negative so subtotals are a plain SUM. "
    "Eldercare shows avoided cost rather than rent, so yield and cash flow do not apply."
)
style(p, f"B{row}", italic=True, size=9, font_color="FF808080")

# =============================================================================
# 3. SCENARIOS
# =============================================================================
sc = wb.create_sheet("Scenarios")
sc.sheet_view.showGridLines = False
sc.column_dimensions["A"].width = 2
sc.column_dimensions["B"].width = 50
for col in "CDE":
    sc.column_dimensions[col].width = 16

band(sc, 1, 2, 5, "SCENARIO ANALYSIS  |  DOWNSIDE, BASE AND UPSIDE")
row = 3
band(sc, row, 2, 5, "SCENARIO INPUTS"); row += 1
subhead(sc, row, 2, 5, ["Input", "Downside", "Base", "Upside"]); row += 1
sin = row
scen_inputs = [
    ("Hard cost per sq ft", 368, 333.33, 280, PSF),
    ("Monthly rent achieved", 3000, 3400, 3800, CUR),
    ("Operating expense ratio", 0.35, 0.30, 0.27, PCT),
    ("Lot is sewered: 1 for yes, 0 for no", 0, 1, 1, NUM),
    ("Soft cost and site work load: utilities, site, design, permits", 62000, 52000, 46000, CUR),
]
for i, (label, d, b, u, fmt) in enumerate(scen_inputs):
    sc.cell(row=row, column=2).value = label
    style(sc, f"B{row}")
    for j, v in enumerate((d, b, u)):
        sc.cell(row=row, column=3 + j).value = v
        style(sc, f"{get_column_letter(3+j)}{row}", font_color=GREEN, fmt=fmt,
              align="center", border=INPUT_BORDER)
    if i % 2 == 0:
        banding(sc, row, 2, 2)
    row += 1
hc, rent, opx, sew, soft = sin, sin + 1, sin + 2, sin + 3, sin + 4
row += 1

band(sc, row, 2, 5, "SCENARIO OUTPUTS"); row += 1
subhead(sc, row, 2, 5, ["Metric", "Downside", "Base", "Upside"]); row += 1
out = row
lines = [
    ("All in project cost",
     lambda c: f"=Unit_SF*{c}{hc}+{c}{soft}+Unit_SF*{c}{hc}*Contingency_Pct+IF({c}{sew}=1,0,Septic_Cost)", CUR),
    ("Cost per sq ft", lambda c: f"={c}{out}/Unit_SF", PSF),
    ("Gross annual rent", lambda c: f"={c}{rent}*12", CUR),
    ("Operating expenses", lambda c: f"=-{c}{out+2}*{c}{opx}", CUR),
    ("Net operating income", lambda c: f"=SUM({c}{out+2}:{c}{out+3})", CUR),
    ("Unlevered yield on cost", lambda c: f"={c}{out+4}/{c}{out}", PCT),
    ("Eldercare payback, low facility case", lambda c: f"={c}{out}/(AL_Low*12)", YRS),
    ("Contribution to the company", lambda c: f"={c}{out}*GM_Pct+Coord_Fee", CUR),
    ("Breakeven units per year", lambda c: f"=Overhead_Y1/{c}{out+7}", RAT),
]
heat_rows = {0: "inv", 2: "pos", 4: "pos", 5: "pos", 6: "inv", 8: "inv"}
for i, (label, fn, fmt) in enumerate(lines):
    sc.cell(row=row, column=2).value = label
    bold = label in ("Net operating income", "Unlevered yield on cost")
    style(sc, f"B{row}", bold=bold,
          border=thin_top if label == "Net operating income" else None)
    for j, c in enumerate("CDE"):
        sc.cell(row=row, column=3 + j).value = fn(c)
        fill = None
        if i in heat_rows:
            good = LTGRN if heat_rows[i] == "pos" else LTRED
            bad = LTRED if heat_rows[i] == "pos" else LTGRN
            fill = bad if j == 0 else (good if j == 2 else None)
        style(sc, f"{c}{row}", fmt=fmt, align="center", fill=fill, bold=bold,
              border=thin_top if label == "Net operating income" else None)
        if j == 1:
            sc[f"{c}{row}"].border = BASE_BOX
    row += 1
row += 1

# --- Sensitivity grid: yield on cost, cost by rent
band(sc, row, 2, 8, "SENSITIVITY: UNLEVERED YIELD ON COST"); row += 1
for col in "FGH":
    sc.column_dimensions[col].width = 16
grid_hdr = row
sc.cell(row=row, column=2).value = "All in cost  \\  monthly rent"
style(sc, f"B{row}", bold=True, fill=LTBLUE)
rents = [2800, 3100, 3400, 3700, 4000]
for j, v in enumerate(rents):
    sc.cell(row=row, column=3 + j).value = v
    style(sc, f"{get_column_letter(3+j)}{row}", font_color=GREEN, bold=True,
          fill=LTBLUE, fmt=CUR, align="center", border=INPUT_BORDER)
row += 1
costs = [318000, 345000, 376000, 410000, 455000]
grid_top = row
for i, cv in enumerate(costs):
    sc.cell(row=row, column=2).value = cv
    style(sc, f"B{row}", font_color=GREEN, bold=True, fill=LTGRAY, fmt=CUR,
          align="center", border=INPUT_BORDER)
    for j in range(len(rents)):
        col = get_column_letter(3 + j)
        sc.cell(row=row, column=3 + j).value = (
            f"={col}${grid_hdr}*12*(1-Opex_Pct)/$B{row}"
        )
        yld = cv and (rents[j] * 12 * 0.70) / cv
        if yld >= 0.080:
            fill = LTGRN
        elif yld >= 0.065:
            fill = None
        else:
            fill = LTRED
        style(sc, f"{col}{row}", fmt=PCT, align="center", fill=fill)
        if i == 2 and j == 2:
            sc[f"{col}{row}"].border = BASE_BOX
            sc[f"{col}{row}"].font = Font(name="Calibri", size=10, bold=True,
                                          color=BLACK)
    row += 1
row += 1
sc.cell(row=row, column=2).value = (
    "Base case is boxed with a dashed border. Cells shade light green at or above 8.0 percent and "
    "light red below the 6.5 percent hurdle. Shading is set at the base operating expense ratio and "
    "does not re-shade when inputs change."
)
style(sc, f"B{row}", italic=True, size=9, font_color="FF808080")

for _ws in wb.worksheets:
    _ws.page_setup.orientation = "landscape"
    _ws.page_setup.fitToWidth = 1
    _ws.page_setup.fitToHeight = 0
    _ws.sheet_properties.pageSetUpPr.fitToPage = True
    _ws.print_options.horizontalCentered = True

wb.save("plinth-ma-adu-project-model.xlsx")
print("saved")
