const pptxgen = require('pptxgenjs');

// ---------- House style constants (Sixth Street IC-memo standard) ----------
const F = 'Calibri';
const NAVY_COVER = '0F2F51';
const NAVY_BAND  = '0E2E51';
const HDR_GRAY   = '858D97';
const BAND       = 'ECEEF0';
const ACCENT     = '005587';
const MUTED      = '9AA0A8';
const TEXT       = '080808';
const LT_RED     = 'F2DCDB';
const LT_GREEN   = 'E2EFDA';
const LT_GRAY    = 'F2F2F2';
const WHITE      = 'FFFFFE';

const M = 0.175;            // side margin
const CW = 9.65;            // content width
const TITLE_Y = 0.09, TITLE_H = 0.52;
const BODY_TOP = 0.66;

const p = new pptxgen();
p.defineLayout({ name: 'SSP', width: 10, height: 7.5 });
p.layout = 'SSP';
p.author = 'Draft business plan';
p.title  = 'Massachusetts ADU Platform';

let pageNo = 0;

function chrome(s, withPage = true) {
  pageNo += 1;
  s.addText('P L I N T H', {
    x: M, y: 7.02, w: 1.6, h: 0.22, fontFace: F, fontSize: 6.5, color: MUTED,
    charSpacing: 2, align: 'left', valign: 'middle', isTextBox: true, margin: 0
  });
  s.addText('C O N F I D E N T I A L   —   D R A F T   F O R   D I S C U S S I O N   P U R P O S E S   O N L Y', {
    x: 2.2, y: 7.02, w: 5.6, h: 0.22, fontFace: F, fontSize: 6, color: MUTED,
    charSpacing: 1, align: 'center', valign: 'middle', isTextBox: true, margin: 0
  });
  if (withPage) {
    s.addText(String(pageNo), {
      x: 8.9, y: 7.02, w: 0.925, h: 0.22, fontFace: F, fontSize: 6.5, color: MUTED,
      align: 'right', valign: 'middle', isTextBox: true, margin: 0
    });
  }
}

function title(s, txt) {
  s.addText(txt, {
    x: M, y: TITLE_Y, w: CW, h: TITLE_H, fontFace: F, fontSize: 22, color: TEXT,
    align: 'left', valign: 'middle', isTextBox: true, margin: 0
  });
}

// Justified takeaway bullets directly under the title
const CPL_FULL = 132;   // chars per line, 10pt Calibri across the content width
function wrapLines(t, cpl) { return Math.max(1, Math.ceil(t.length / cpl)); }

function takeaway(s, lines, y = BODY_TOP) {
  const items = lines.map((t, i) => ({
    text: t,
    options: {
      bullet: { code: '2022' }, breakLine: i < lines.length - 1,
      paraSpaceBefore: 3, paraSpaceAfter: 3
    }
  }));
  const nLines = lines.reduce((a, t) => a + wrapLines(t, CPL_FULL), 0);
  const h = 0.172 * nLines + 0.085 * lines.length + 0.06;
  s.addText(items, {
    x: M, y, w: CW, h, fontFace: F, fontSize: 10, color: TEXT,
    align: 'justify', valign: 'top', isTextBox: true, margin: 0, lineSpacingMultiple: 1.0
  });
  return y + h + 0.06;
}

function footnote(s, txt, y) {
  s.addText(txt, {
    x: M, y, w: CW, h: 0.5, fontFace: F, fontSize: 7, color: MUTED, italic: true,
    align: 'left', valign: 'top', isTextBox: true, margin: 0
  });
}

// Data table: navy title band, gray column header, alternating banding, centered
function dataTable(s, opts) {
  const { bandTitle, head, rows, y, colW, totalRow, heat } = opts;
  const nCols = head.length;
  const body = [];

  if (bandTitle) {
    body.push([{
      text: bandTitle,
      options: { colspan: nCols, fill: NAVY_BAND, color: WHITE, bold: true,
                 fontSize: 10, align: 'left', valign: 'middle', margin: [2, 4, 2, 4] }
    }]);
  }
  body.push(head.map((h, i) => ({
    text: h,
    options: { fill: HDR_GRAY, color: WHITE, bold: true, fontSize: 10,
               align: (i === 0 || opts.leftAll) ? 'left' : 'center', valign: 'middle', margin: [2, 4, 2, 4] }
  })));

  rows.forEach((r, ri) => {
    const isTot = totalRow && ri === rows.length - 1;
    const fill = isTot ? LT_GRAY : (ri % 2 === 0 ? BAND : null);
    body.push(r.map((c, ci) => {
      const o = {
        fontSize: 10, bold: isTot || ci === 0 && opts.boldFirst,
        align: (ci === 0 || opts.leftAll) ? 'left' : 'center', valign: 'middle',
        color: TEXT, margin: [2, 4, 2, 4]
      };
      if (fill) o.fill = fill;
      if (heat && heat[ri] && heat[ri][ci]) o.fill = heat[ri][ci];
      if (isTot) o.border = [{ type: 'solid', color: ACCENT, pt: 1 }, { type: 'none' }, { type: 'none' }, { type: 'none' }];
      return { text: c, options: o };
    }));
  });

  s.addTable(body, {
    x: M, y, w: CW, colW, fontFace: F, border: { type: 'none' },
    autoPage: false, rowH: 0.0
  });

  // Estimate rendered height so a following table can be placed safely
  const CPI = 13.2;                       // chars per inch, 10pt Calibri
  const lineH = 0.155, pad = 0.075;
  const cellLines = (txt, w) =>
    Math.max(1, Math.ceil(String(txt).length / Math.max(4, (w - 0.12) * CPI)));
  let h = bandTitle ? 0.28 : 0;
  h += Math.max(...head.map((t, i) => cellLines(t, colW[i]))) * lineH + pad;
  rows.forEach(r => {
    h += Math.max(...r.map((c, i) => cellLines(c, colW[i]))) * lineH + pad;
  });
  return h;
}

// Narrative label + bullets: 15% gray label box, 85% bullets
function labelBullets(s, blocks, yStart) {
  let y = yStart;
  blocks.forEach(b => {
    const nl = b.bullets.reduce((a, t) => a + wrapLines(t, 112), 0);
    const h = Math.max(0.46, 0.172 * nl + 0.085 * b.bullets.length + 0.10);
    s.addShape(p.ShapeType.rect, { x: M, y, w: CW * 0.15, h, fill: { color: LT_GRAY }, line: { color: LT_GRAY, width: 0 } });
    s.addText(b.label, {
      x: M, y, w: CW * 0.15, h, fontFace: F, fontSize: 10, bold: true, color: TEXT,
      align: 'center', valign: 'middle', isTextBox: true, margin: 2
    });
    const items = [];
    b.bullets.forEach((t, i) => {
      const last = i === b.bullets.length - 1;
      const m = /^([A-Z][A-Za-z0-9 ,/]{2,30}):\s+/.exec(t);
      const base = { bullet: { code: '2022' }, paraSpaceBefore: 3, paraSpaceAfter: 3 };
      if (m) {
        items.push({ text: m[1] + ': ', options: { bold: true, paraSpaceBefore: 3, paraSpaceAfter: 3 } });
        items.push({ text: t.slice(m[0].length), options: { breakLine: !last } });
      } else {
        items.push({ text: t, options: Object.assign({}, base, { breakLine: !last }) });
      }
    });
    s.addText(items, {
      x: M + CW * 0.15 + 0.10, y, w: CW * 0.85 - 0.10, h,
      fontFace: F, fontSize: 10, color: TEXT, align: 'left', valign: 'middle',
      isTextBox: true, margin: 0, indentLevel: 0
    });
    y += h + 0.09;
  });
  return y;
}

/* ===================== 1. COVER ===================== */
{
  const s = p.addSlide();
  s.background = { color: NAVY_COVER };
  s.addText('P L I N T H', {
    x: 6.0, y: 0.35, w: 3.825, h: 0.3, fontFace: F, fontSize: 9, color: WHITE,
    charSpacing: 3, align: 'right', valign: 'middle', isTextBox: true, margin: 0
  });
  s.addText('MASSACHUSETTS\nACCESSORY DWELLING\nUNIT PLATFORM', {
    x: 1.0, y: 4.05, w: 8.35, h: 1.75, fontFace: F, fontSize: 38, color: WHITE,
    align: 'right', valign: 'bottom', isTextBox: true, margin: 0, lineSpacingMultiple: 0.92
  });
  s.addText([
    { text: 'Draft Business Plan', options: { breakLine: true } },
    { text: 'Prepared September 2026', options: { breakLine: true } },
    { text: 'For Discussion Purposes Only', options: {} }
  ], {
    x: 1.0, y: 5.95, w: 8.35, h: 0.85, fontFace: F, fontSize: 16, color: WHITE,
    align: 'right', valign: 'top', isTextBox: true, margin: 0
  });
  pageNo += 0;
}

/* ===================== 2. EXECUTIVE SUMMARY ===================== */
{
  const s = p.addSlide();
  title(s, 'EXECUTIVE SUMMARY');
  const rows = [
    ['Opportunity', 'Design and deliver accessory dwelling units in Massachusetts, legal by right statewide since February 2, 2025'],
    ['Product', 'Four standard units from 400 sq ft to 900 sq ft, accessible by default, delivered in 24 to 32 weeks'],
    ['Flagship unit', '900 sq ft, two bedroom, $376,000 all in on a sewered lot, or $418 per sq ft'],
    ['Target segments', 'Eldercare and multigenerational, downsize in place, and investor. Employer and workforce deferred'],
    ['Priority segment', 'Eldercare, at roughly 61% of national ADU demand and a 3.3 to 4.3 year payback against assisted living'],
    ['Owner financing', 'Up to $300,000 per project: MassHousing to $250,000 plus Home Modification Loan Program to $50,000 at 0%'],
    ['Base case return', '7.6% unlevered yield on cost at $3,400 per month of rent'],
    ['Delivery model', 'Asset light. Panelized or modular shell from a certified manufacturer, local general contractor for site and finish'],
    ['Company breakeven', '5.4 units per year at $83,000 of contribution per contract against $450,000 of fixed overhead'],
    ['Capital required', '$750,000 to fund 18 months of overhead, factory deposits and working capital'],
  ];
  dataTable(s, {
    bandTitle: 'Transaction Overview',
    head: ['Item', 'Detail'],
    rows, y: BODY_TOP, colW: [2.15, 7.50], boldFirst: true, leftAll: true
  });
  footnote(s, 'Note: all figures are illustrative and modelled, not sourced from executed contracts. Costs require validation against manufacturer quotes and a site specific assessment.', 6.55);
  chrome(s);
}

/* ===================== 3. WHAT AN ADU IS ===================== */
{
  const s = p.addSlide();
  title(s, 'THE PRODUCT AND WHY THE MODEL WORKS');
  const y = takeaway(s, [
    'An accessory dwelling unit is a second, smaller, self contained home on a lot that already holds a single family house, either attached to the house or free standing in the yard.',
    'The land is already owned and already paid for, so marginal land cost is zero. A developer buying a lot in Newton to build one 900 sq ft rental unit pays more for the dirt than for the building.',
    'We believe this is why ADUs are the only mechanism that adds small rental units to expensive single family neighbourhoods, and why apartment construction elsewhere does not substitute for them.'
  ]);
  labelBullets(s, [
    { label: 'ECONOMICS', bullets: [
      'Zero marginal land cost: the single largest input in any housing development is removed from the cost stack entirely.',
      'Fixed costs dominate: a kitchen, a bathroom and a utility connection cost roughly the same at 400 sq ft as at 900 sq ft, so cost per sq ft falls from $580 at 400 sq ft to $418 at 900 sq ft.'
    ]},
    { label: 'DEMAND', bullets: [
      'Primary motivation: multigenerational housing drives 61% of ADUs built nationally, with 73% of owners citing accessibility.',
      'Competing product: Massachusetts assisted living runs a median of $7,250 to $9,600 per month, which is what this segment is really choosing against.'
    ]},
    { label: 'SUPPLY', bullets: [
      'Statewide deficit: Massachusetts needs 222,000 additional homes between 2025 and 2035, and added 34,500 in 2025.',
      'Missing product: small units are structurally undersupplied because they are uneconomic to build standalone, which is precisely the gap this fills.'
    ]},
  ], y + 0.06);
  footnote(s, 'Sources: OnePoll ADU survey via HousingWire; AARP; CareScout and Genworth Cost of Care; Massachusetts Executive Office of Housing and Livable Communities.', 6.55);
  chrome(s);
}

/* ===================== 4. WHY MASSACHUSETTS ===================== */
{
  const s = p.addSlide();
  title(s, 'WHY MASSACHUSETTS (1 OF 2)');
  const y = takeaway(s, [
    'The Affordable Homes Act was signed August 6, 2024 and the implementing regulation at 760 CMR 71.00 took effect February 2, 2025, making a protected use ADU legal by right in every city and town.',
    'Over 1,200 ADUs were approved in the first year, with 840 applications reported by September 2025.',
    'Massachusetts prohibits the three restrictions that make the New York and Connecticut markets unworkable: owner occupancy mandates, discretionary permitting, and municipal opt out.'
  ]);
  dataTable(s, {
    bandTitle: 'Protected Use ADU: What a Massachusetts Municipality May and May Not Require',
    head: ['Parameter', 'Massachusetts', 'East Hampton, NY', 'Connecticut'],
    rows: [
      ['Entitlement path', 'By right, no special permit, no public hearing', 'Permit capped, annual renewal', 'Opt out repealed in 115 of 169 towns'],
      ['Maximum size, detached', '900 sq ft, or 50% of principal dwelling', '600 sq ft', '1,000 sq ft where baseline applies'],
      ['Owner occupancy', 'Cannot be required, of either unit', 'Required', 'Varies by town'],
      ['Rent cap', 'None', '130% of HUD Fair Market Rent', 'None'],
      ['Tenant income or work test', 'None', 'Residency test, annual renewal', 'None'],
      ['Parking', 'One space maximum, zero within 0.5 mi of transit', 'Two off street spaces', 'One space'],
      ['Statutory permit cap', 'None', '200 town wide, 40 per school district', 'None'],
      ['Short term rental', 'May be restricted by the town', 'Prohibited', 'Varies'],
    ],
    y: y + 0.06, colW: [2.30, 2.85, 2.35, 2.15], boldFirst: true
  });
  footnote(s, 'Sources: 760 CMR 71.00; Massachusetts Executive Office of Housing and Livable Communities; Town of East Hampton; Connecticut Public Act 21 29. Regulatory detail current as of September 23, 2026 and requires primary source verification.', 6.42);
  chrome(s);
}

/* ===================== 5. MARKET CONTEXT ===================== */
{
  const s = p.addSlide();
  title(s, 'WHY MASSACHUSETTS (2 OF 2): DEMAND PICTURE');
  const y = takeaway(s, [
    'The investment case is not a general rental shortage. Massachusetts rental vacancy rose from 3.40% in January 2025 to 4.90% in the first quarter of 2026, and Greater Boston rent growth has fallen to 1.04% year over year.',
    'Rent softness disqualifies the lower cost gateway cities for investor deals but has no effect on the eldercare segment, whose comparison is a $7,250 to $9,600 monthly facility bill rather than a rent roll.',
    'We therefore underwrite the plan to segment specific demand in high rent suburbs and to family driven demand statewide, not to a market wide supply deficit.'
  ]);
  dataTable(s, {
    bandTitle: 'Massachusetts Rental Market Indicators',
    head: ['Indicator', 'Prior', 'Current', 'Direction'],
    rows: [
      ['Massachusetts rental vacancy rate', '3.40% (Jan 2025)', '4.90% (Q1 2026)', 'Loosening'],
      ['Greater Boston rent growth, year over year', 'n.a.', '1.04%', 'Flat'],
      ['Boston managed multifamily vacancy (Colliers)', 'n.a.', '6.90%', 'Loosening'],
      ['Worcester average rent, year over year', '$2,068', '$2,054', 'Down 0.68%'],
      ['Lowell average rent, year over year', '$2,220', '$2,266', 'Up 2.07%'],
      ['Lawrence average rent, year over year', '$2,232', '$2,320', 'Up 3.95%'],
      ['Statewide housing units required, 2025 to 2035', 'n.a.', '222,000', 'Ahead of pace'],
      ['Units added, 2025', 'n.a.', '34,500', 'Ahead of pace'],
    ],
    y: y + 0.06, colW: [4.15, 1.80, 1.85, 1.85], boldFirst: true
  });
  footnote(s, 'Sources: Federal Reserve Bank of St. Louis (MARVAC); Colliers; RentCafe; Boston Pads; Massachusetts Executive Office of Housing and Livable Communities. Rent data varies materially by vendor and should be verified against comparable listings.', 6.42);
  chrome(s);
}

/* ===================== 6. SEGMENTS OVERVIEW ===================== */
{
  const s = p.addSlide();
  title(s, 'TARGET SEGMENTS');
  const y = takeaway(s, [
    'In two of the three segments the buyer is not the occupant, which means marketing written to the person living in the unit misses the person writing the cheque.',
    'Eldercare ranks first on share of demand, payback, price insensitivity and resilience to a softening rental market, and is the only segment whose economics do not reference rent at all.',
    'The employer and workforce segment has been deferred: it requires a three sided market, carries a 12 to 18 month institutional sales cycle, and delivers the lowest near term volume.'
  ]);
  dataTable(s, {
    bandTitle: 'Segment Comparison',
    head: ['', 'Eldercare', 'Downsize in Place', 'Investor'],
    rows: [
      ['Share of national ADU demand', 'c. 61%', 'Not separately measured', 'Narrow'],
      ['Who decides', 'Adult child, age 50 to 65', 'The owner, age 60 to 72', 'Investor'],
      ['What they are buying', 'Proximity and dignity', 'Income and staying put', 'Yield'],
      ['Competing product', 'Assisted living at $7,250 to $9,600 per month', 'Selling and moving', 'Any other rental asset'],
      ['Key metric', '3.3 to 4.3 year payback', '8.95% yield on cost', '7.6% yield on cost'],
      ['Owner financing available', 'Up to $300,000', 'Up to $250,000', 'None. Conventional only'],
      ['Price sensitivity', 'Lowest', 'Low', 'Highest'],
      ['Sales cycle', '2 to 6 months', '3 to 9 months', '1 to 3 months'],
      ['Survives a soft rental market', 'Yes', 'Partly', 'No'],
      ['Priority', '1', '2', '3'],
    ],
    y: y + 0.06, colW: [3.05, 2.35, 2.25, 2.00], boldFirst: true, totalRow: true
  });
  footnote(s, 'Sources: OnePoll ADU survey via HousingWire; CareScout and Genworth Cost of Care Survey; MassHousing; Massachusetts Community Economic Development Assistance Corporation.', 6.42);
  chrome(s);
}

/* ===================== 7. SEGMENT 1 ELDERCARE ===================== */
{
  const s = p.addSlide();
  title(s, 'SEGMENT ECONOMICS: ELDERCARE');
  const y = takeaway(s, [
    'Massachusetts assisted living runs a median of $7,250 to $9,600 per month, or $87,000 to $115,200 per year, against a one time project cost of $376,000.',
    'Assisted living is a consumption expense that depletes the estate. An ADU is a capital improvement that preserves it, and converts to a rental generating roughly $28,560 of net operating income once the unit is no longer needed.',
    'This segment is insensitive to rent levels, which makes it the only one of the three that is fully defended against the vacancy and rent softening shown on the previous page.'
  ]);
  dataTable(s, {
    bandTitle: 'Eldercare: Project Payback Against the Competing Product',
    head: ['', 'Low facility cost', 'Median facility cost', 'Greater Boston'],
    rows: [
      ['Assisted living, monthly', '$7,250', '$8,400', '$9,600'],
      ['Assisted living, annual', '$87,000', '$100,800', '$115,200'],
      ['ADU all in project cost', '$376,000', '$376,000', '$376,000'],
      ['Years to break even', '4.3x', '3.7x', '3.3x'],
      ['Five year cost of facility', '$435,000', '$504,000', '$576,000'],
      ['Five year cost of ADU', '$376,000', '$376,000', '$376,000'],
      ['Five year saving', '$59,000', '$128,000', '$200,000'],
      ['Residual asset value retained', 'Yes', 'Yes', 'Yes'],
    ],
    y: y + 0.06, colW: [3.35, 2.10, 2.10, 2.10], boldFirst: true
  });
  footnote(s, 'Note: excludes the residual value of the ADU itself, which converts to a rental at roughly $28,560 of NOI, and excludes any increase in facility cost over the period. Facility cost source: CareScout and Genworth 2025 and 2026 Cost of Care Survey.', 6.42);
  chrome(s);
}

/* ===================== 8. SEGMENT 2 DOWNSIZE ===================== */
{
  const s = p.addSlide();
  title(s, 'SEGMENT ECONOMICS: DOWNSIZE IN PLACE');
  const y = takeaway(s, [
    'Because Massachusetts forbids a municipality from requiring owner occupancy of either unit, the owner can build the ADU, move into it, and rent out the family home. This is prohibited under most New York accessory apartment codes.',
    'Three bedroom single family homes in the Boston metro rent at $4,007 per month, materially above what a two bedroom ADU commands, so renting the main house rather than the new unit is the superior configuration.',
    'The owner also avoids capital gains above the $500,000 exclusion, brokerage and moving costs, and the purchase of a replacement home in a market where downsizing does not reduce cost.'
  ]);
  dataTable(s, {
    bandTitle: 'Downsize in Place: Owner Returns',
    head: ['', 'Rent the ADU', 'Rent the main house', 'Delta'],
    rows: [
      ['Monthly rent achieved', '$3,400', '$4,007', '$607'],
      ['Gross annual rent', '$40,800', '$48,084', '$7,284'],
      ['Operating expenses at 30%', '($12,240)', '($14,425)', '($2,185)'],
      ['Net operating income', '$28,560', '$33,659', '$5,099'],
      ['All in project cost', '$376,000', '$376,000', '-'],
      ['Unlevered yield on cost', '7.6%', '8.95%', '135 bps'],
      ['Less MassHousing and HMLP financing', '($300,000)', '($300,000)', '-'],
      ['Owner cash invested', '$76,000', '$76,000', '-'],
      ['Annual debt service on the MassHousing loan', '($22,367)', '($22,367)', '-'],
      ['Net cash flow after debt service', '$6,193', '$11,292', '$5,099'],
      ['Cash on cash return on owner cash', '8.1%', '14.9%', '680 bps'],
    ],
    y: y + 0.06, colW: [3.35, 2.10, 2.10, 2.10], boldFirst: true, totalRow: true
  });
  footnote(s, 'Note: debt service assumes $250,000 amortising over 20 years at an assumed 6.5%, or $22,367 per year. The $50,000 Home Modification Loan Program layer carries no interest and no monthly payment, so it reduces owner cash without adding debt service. Excludes principal amortisation of roughly $7,700 in year one.', 6.28);
  chrome(s);
}

/* ===================== 9. SEGMENT 3 INVESTOR ===================== */
{
  const s = p.addSlide();
  title(s, 'SEGMENT ECONOMICS: INVESTOR');
  const y = takeaway(s, [
    'At a base cost of $376,000 an investor needs roughly $2,909 per month of achievable rent to clear a 6.5% unlevered yield, which is the screening threshold applied to every prospective market and lot.',
    'The segment is geographically narrow. High rent inner suburbs clear the threshold comfortably while the gateway cities do not, and Worcester rents fell 0.68% over the last year.',
    'Investors are the only segment locked out of every subsidised programme, because MassHousing and the Home Modification Loan Program both require the property to be a primary residence.'
  ]);
  dataTable(s, {
    bandTitle: 'Achievable Rent Screen by Market, 900 Sq Ft Two Bedroom at $376,000 All In',
    head: ['Market', '2BR rent', 'Gross rent', 'NOI at 30%', 'Yield on cost', 'Verdict'],
    rows: [
      ['Newton', '$4,400', '$52,800', '$36,960', '9.8%', 'Clears'],
      ['Medford', '$3,432', '$41,184', '$28,829', '7.7%', 'Clears'],
      ['Somerville', '$3,400', '$40,800', '$28,560', '7.6%', 'Clears'],
      ['Lowell', '$2,446', '$29,352', '$20,546', '5.5%', 'Marginal'],
      ['Lawrence', '$2,415', '$28,980', '$20,286', '5.4%', 'Marginal'],
      ['Worcester', '$2,156', '$25,872', '$18,110', '4.8%', 'Fails'],
      ['Screening threshold at 6.5%', '$2,909', '$34,914', '$24,440', '6.5%', '-'],
    ],
    y: y + 0.06, colW: [2.75, 1.35, 1.40, 1.40, 1.40, 1.35], boldFirst: true, totalRow: true,
    heat: {
      0: { 4: LT_GREEN }, 1: { 4: LT_GREEN }, 2: { 4: LT_GREEN },
      3: { 4: LT_GRAY }, 4: { 4: LT_GRAY }, 5: { 4: LT_RED }
    }
  });
  footnote(s, 'Sources: RentCafe and Zumper two bedroom averages, September 2026. Rent data varies materially by vendor and requires verification against comparable listings before underwriting any individual deal.', 6.42);
  chrome(s);
}

/* ===================== 10. PROJECT COST BUILD ===================== */
{
  const s = p.addSlide();
  title(s, 'PROJECT ECONOMICS (1 OF 3): COST BUILD');
  const y = takeaway(s, [
    'A 900 sq ft detached unit on a sewered lot is underwritten at $376,000 all in, or $418 per sq ft, against a Greater Boston market range of $300 to $400 per sq ft for hard cost alone.',
    'Hard cost represents 80% of the budget. The three items that most commonly break the budget are wastewater on an unsewered lot, an electrical service upgrade, and difficult site access for equipment.',
    'An unsewered lot requiring a Title 5 compliant or nitrogen reducing system adds approximately $35,000 net of available grants, which is modelled in the downside case.'
  ]);
  dataTable(s, {
    bandTitle: 'Cost Build, 900 Sq Ft Detached Two Bedroom on a Sewered Lot',
    head: ['Cost line', 'Amount', '$ per sq ft', '% of total'],
    rows: [
      ['Hard cost: foundation, shell, systems and interior', '$300,000', '$333', '79.8%'],
      ['Utility service, laterals and trenching', '$18,000', '$20', '4.8%'],
      ['Site work, access and restoration', '$12,000', '$13', '3.2%'],
      ['Design, structural engineering and survey', '$16,000', '$18', '4.3%'],
      ['Permits and municipal fees', '$6,000', '$7', '1.6%'],
      ['Contingency at 8% of hard cost', '$24,000', '$27', '6.4%'],
      ['Total all in project cost', '$376,000', '$418', '100.0%'],
    ],
    y: y + 0.06, colW: [4.85, 1.60, 1.60, 1.60], boldFirst: true, totalRow: true
  });
  footnote(s, 'Note: excludes wastewater on an unsewered lot, electrical service upgrade beyond 200 amp, tree removal, ledge or rock excavation, and any historic district review cost. Illustrative and modelled; requires validation against manufacturer and subcontractor quotes.', 6.42);
  chrome(s);
}

/* ===================== 11. FINANCING ===================== */
{
  const s = p.addSlide();
  title(s, 'PROJECT ECONOMICS (2 OF 3): OWNER FINANCING');
  const y = takeaway(s, [
    'An owner occupant can assemble up to $300,000 of favourable financing against a $376,000 project, reducing cash at closing to $76,000, or 20% of project cost.',
    'The Home Modification Loan Program lends up to $50,000 at 0% interest with no monthly payments, deferred until sale or refinance, under broad income eligibility, and accessory dwelling units are an explicitly eligible project.',
    'Both programmes are finite. The MassHousing pool is $5,000,000, which funds roughly twenty detached units, so we do not underwrite a pipeline on the assumption that every prospect is funded.'
  ]);
  const t11 = dataTable(s, {
    bandTitle: 'Sources and Uses, Owner Occupant Project',
    head: ['Sources', 'Amount', '% of total', 'Terms'],
    rows: [
      ['MassHousing ADU construction loan', '$250,000', '66.5%', 'Fixed rate second mortgage, 20 year amortisation'],
      ['Home Modification Loan Program', '$50,000', '13.3%', '0% interest, no monthly payment, deferred to sale'],
      ['Owner equity', '$76,000', '20.2%', 'Cash at closing'],
      ['Total sources', '$376,000', '100.0%', '-'],
    ],
    y: y + 0.06, colW: [3.20, 1.35, 1.25, 3.85], boldFirst: true, totalRow: true
  });
  const y11 = y + 0.06 + t11 + 0.26;
  dataTable(s, {
    bandTitle: 'Programme Constraints',
    head: ['Programme', 'Maximum', 'Income test', 'Primary residence required'],
    rows: [
      ['MassHousing ADU loan, detached', '$250,000', 'Up to 135% of area median income', 'Yes'],
      ['MassHousing ADU loan, attached', '$150,000', 'Up to 135% of area median income', 'Yes'],
      ['Home Modification Loan Program', '$50,000', 'Broad eligibility', 'Yes'],
      ['Investor, conventional or DSCR', 'Market', 'None', 'No'],
    ],
    y: y11, colW: [3.20, 1.60, 3.20, 1.65], boldFirst: true
  });
  footnote(s, 'Sources: MassHousing; Massachusetts Community Economic Development Assistance Corporation. Programme terms are subject to change and funding pools are finite.', 6.42);
  chrome(s);
}

/* ===================== 12. SCENARIOS ===================== */
{
  const s = p.addSlide();
  title(s, 'PROJECT ECONOMICS (3 OF 3): SCENARIOS');
  const y = takeaway(s, [
    'The base case returns a 7.6% unlevered yield on a $376,000 project at $3,400 per month of rent, with the eldercare payback at 4.3 years against a $7,250 monthly facility cost.',
    'Breakeven at a 6.5% hurdle requires either $2,909 per month of rent at base cost, or a cost of $439,000 at base rent, giving roughly 17% of cost cushion before the base case deal fails.',
    'The downside case combines a 21% cost overrun, an unsewered lot, $3,000 of monthly rent and a 35% expense load, and still clears 5.1%. We view the principal downside risk as cost, not rent.'
  ]);
  dataTable(s, {
    bandTitle: 'Downside, Base and Upside, 900 Sq Ft Two Bedroom',
    head: ['', 'Downside', 'Base', 'Upside'],
    rows: [
      ['All in project cost', '$455,000', '$376,000', '$318,000'],
      ['Cost per sq ft', '$506', '$418', '$353'],
      ['Monthly rent achieved', '$3,000', '$3,400', '$3,800'],
      ['Gross annual rent', '$36,000', '$40,800', '$45,600'],
      ['Operating expense ratio', '35.0%', '30.0%', '27.0%'],
      ['Net operating income', '$23,400', '$28,560', '$33,288'],
      ['Unlevered yield on cost', '5.1%', '7.6%', '10.5%'],
      ['Eldercare payback at $7,250 per month', '5.2x', '4.3x', '3.7x'],
      ['Contribution to the company at 20% margin', '$99,000', '$83,200', '$71,600'],
    ],
    y: y + 0.06, colW: [4.25, 1.80, 1.80, 1.80], boldFirst: true,
    heat: {
      0: { 1: LT_RED, 3: LT_GREEN }, 2: { 1: LT_RED, 3: LT_GREEN },
      5: { 1: LT_RED, 3: LT_GREEN }, 6: { 1: LT_RED, 3: LT_GREEN },
      7: { 1: LT_RED, 3: LT_GREEN }
    }
  });
  s.addShape(p.ShapeType.rect, { x: M, y: 5.72, w: CW, h: 0.62, fill: { color: NAVY_BAND }, line: { color: NAVY_BAND, width: 0 } });
  s.addText('Breakeven: at the base cost of $376,000 the project requires $2,909 per month of rent to clear a 6.5% hurdle. At the base rent of $3,400 per month it supports a cost of $439,000, or 17% above budget, before the hurdle is missed.', {
    x: M + 0.12, y: 5.72, w: CW - 0.24, h: 0.62, fontFace: F, fontSize: 10, color: WHITE, bold: true,
    align: 'left', valign: 'middle', isTextBox: true, margin: 0
  });
  footnote(s, 'Note: downside assumes an unsewered lot requiring a nitrogen reducing system at approximately $35,000 net of grants, plus a 12% hard cost overrun. Upside assumes a repeat standard design on a clean sewered site with no service upgrade.', 6.48);
  chrome(s);
}

/* ===================== 13. PRODUCT LINE ===================== */
{
  const s = p.addSlide();
  title(s, 'PRODUCT LINE: FOUR STANDARD UNITS');
  const y = takeaway(s, [
    'Four standard units rather than bespoke design. A kitchen, a bathroom and a utility connection cost approximately the same at 400 sq ft as at 900 sq ft, so cost per sq ft falls 28% across the range from $580 to $418.',
    'Unit C at 900 sq ft is the flagship and the default recommendation: it is the largest size Massachusetts protects by right, it clears the investor rent threshold, and it accommodates a live in aide.',
    'Every unit is built accessible as standard rather than as an upgrade: single level, zero threshold entry, 36 inch doors, curbless shower and blocking for future grab bars. A unit that cannot take a wheelchair is unsellable to 61% of the market.'
  ]);
  const t13 = dataTable(s, {
    bandTitle: 'Standard Unit Specifications, Cost and Delivery',
    head: ['Unit', 'Size', 'Configuration', 'Primary segment', 'All in cost', '$ per sq ft', 'Weeks'],
    rows: [
      ['A  Studio', '400 sq ft', 'Studio, one bath', 'Eldercare, budget', '$232,000', '$580', '24'],
      ['B  One', '600 sq ft', 'One bed, one bath', 'Eldercare, downsize', '$290,000', '$483', '26'],
      ['C  Two', '900 sq ft', 'Two bed, one bath', 'All three segments', '$376,000', '$418', '30'],
      ['D  Two Plus', '900 sq ft', 'Two bed, two bath', 'Eldercare with aide', '$398,000', '$442', '32'],
    ],
    y: y + 0.06, colW: [1.35, 1.10, 1.70, 1.95, 1.35, 1.10, 1.10], boldFirst: true
  });
  const y13 = y + 0.06 + t13 + 0.26;
  dataTable(s, {
    bandTitle: 'Accessibility Specification, Standard on Every Unit',
    head: ['Element', 'Specification', 'Element', 'Specification'],
    rows: [
      ['Entry', 'Zero threshold, no step', 'Bathroom', 'Curbless roll in shower'],
      ['Circulation', 'Single level, 36 inch doors', 'Walls', 'Blocking for future grab bars'],
      ['Hardware', 'Lever throughout', 'Systems', 'All electric, heat pump, induction'],
    ],
    y: y13, colW: [1.60, 3.20, 1.55, 3.30], boldFirst: true
  });
  footnote(s, 'Note: costs assume a sewered lot with standard access and no service upgrade. Delivery weeks are measured from signed contract to certificate of occupancy. Illustrative and modelled.', 6.42);
  chrome(s);
}

/* ===================== 14. SCHEDULE ===================== */
{
  const s = p.addSlide();
  title(s, 'DELIVERY SCHEDULE: 30 WEEKS TO OCCUPANCY');
  const y = takeaway(s, [
    'A 900 sq ft unit is delivered in 30 weeks, against 12 to 18 months for comparable custom site built work, with the by right entitlement path removing the public hearing that drives most of the variance.',
    'Factory fabrication runs in parallel with permitting and site work, which is where the schedule compression is generated. Approximately 14 weeks of fabrication overlaps 10 weeks of permitting and site preparation.',
    'The module set itself takes one day. Roughly 85% of the on site labour hours of an equivalent site built unit are removed from the critical path.'
  ]);
  dataTable(s, {
    bandTitle: 'Delivery Schedule, Unit C at 900 Sq Ft',
    head: ['Phase', 'Weeks', 'Duration', 'Owner action required', 'Runs in parallel'],
    rows: [
      ['Feasibility and site assessment', '1 to 2', '2 weeks', 'Site access, deed and survey', 'No'],
      ['Design and owner approval', '3 to 6', '4 weeks', 'Design sign off', 'No'],
      ['Building permit, by right', '7 to 12', '6 weeks', 'Signature on application', 'Yes'],
      ['Factory fabrication', '9 to 22', '14 weeks', 'Deposit', 'Yes'],
      ['Site work, foundation and utilities', '19 to 22', '4 weeks', 'None', 'Yes'],
      ['Module set and weathertight', '23', '1 day', 'Vehicle access cleared', 'No'],
      ['Finish, connections and inspections', '24 to 28', '5 weeks', 'Finish selections', 'No'],
      ['Certificate of occupancy', '29 to 30', '2 weeks', 'Final walkthrough', 'No'],
      ['Total elapsed', '1 to 30', '30 weeks', '-', '-'],
    ],
    y: y + 0.06, colW: [3.05, 1.30, 1.30, 2.60, 1.40], boldFirst: true, totalRow: true
  });
  footnote(s, 'Note: permitting duration assumes a protected use ADU processed by right under 760 CMR 71.00 with no special permit and no public hearing. An unsewered lot requiring Title 5 review adds 6 to 10 weeks.', 6.42);
  chrome(s);
}

/* ===================== 15. HOW WE BUILD ===================== */
{
  const s = p.addSlide();
  title(s, 'HOW WE BUILD (1 OF 2): CONSTRUCTION METHOD');
  const y = takeaway(s, [
    'Massachusetts site built ADUs run $300 to $400 per sq ft while modular comparables run $325 to $600 per sq ft, so we do not believe modular delivery is materially cheaper in this market.',
    'We view the case for factory delivery as schedule certainty, weather independence, quality consistency and above all repeatability, which is what converts a construction practice into a product business.',
    'The recommended configuration is therefore hybrid: a panelised or modular shell from a certified manufacturer, with a local general contractor performing site work, set and finish.'
  ]);
  labelBullets(s, [
    { label: 'METHOD', bullets: [
      'Hybrid delivery: factory built shell, local general contractor for foundation, utilities, set and interior finish.',
      'Concern: modular carries no clear cost advantage in Massachusetts, unlike high labour cost markets such as the East End of Long Island where trades bill $100 to $500 per hour.',
      'Mitigant: we underwrite the decision on schedule and repeatability rather than on price, and we retain the option to build site built on any lot where access or crane cost makes a module uneconomic.'
    ]},
    { label: 'CODE PATH', bullets: [
      'Governing code: manufactured buildings fall under 780 CMR 110.R3, administered by the State Board of Building Regulations and Standards.',
      'Certification: the manufacturer retains a BBRS registered Third Party Inspection Agency, and labels attach at the factory covering structural, mechanical, electrical and plumbing scope.',
      'Local scope: the building official retains zoning, siting, foundation and utility connection only, which materially narrows local discretion on every project.'
    ]},
    { label: 'CAPITAL', bullets: [
      'Concern: fixed factory overhead against lumpy, permit gated demand is the specific mechanism that closed Katerra, which raised $2.4 billion, and Veev, which raised $600 million and liquidated.',
      'Mitigant: we will not own manufacturing. Contract fabrication requires no plant capital and no fixed absorption, and two qualified manufacturers will be held under a manufacturer agnostic specification.'
    ]},
  ], y + 0.06);
  footnote(s, 'Sources: 780 CMR 110.R3; Massachusetts Board of Building Regulations and Standards; Ecocor, BrightBuilt Home and Abodu published pricing; Massachusetts contractor cost guides, 2026.', 6.55);
  chrome(s);
}

/* ===================== 16. SUPPLY CHAIN ===================== */
{
  const s = p.addSlide();
  title(s, 'HOW WE BUILD (2 OF 2): SUPPLY CHAIN');
  const y = takeaway(s, [
    'Two qualified manufacturers will be held at all times against a manufacturer agnostic specification, eliminating the single point of failure in schedule, quality and price that concentration would create.',
    'The Northeast manufacturing base is deep and within economic freight range of eastern Massachusetts, with panelised Passive House capability available in Maine and southern New Hampshire.',
    'The founding team is three people. A Massachusetts licensed Construction Supervisor is the first and most important hire, because the capability gap in this business is construction and land use, not design.'
  ]);
  const t16 = dataTable(s, {
    bandTitle: 'Qualified Manufacturer Candidates',
    head: ['Manufacturer', 'Location', 'Method', 'Relevance'],
    rows: [
      ['KBS Builders', 'South Paris, ME', 'Volumetric modular', '150,000 sq ft capacity, multifamily and affordable experience'],
      ['Bensonwood and Unity Homes', 'Walpole, NH', 'Panelised, high performance', 'Closest to eastern Massachusetts, Passive House standard'],
      ['Ecocor', 'Maine', 'Panelised, certified Passive House', 'First certified Passive House component maker in North America'],
      ['Westchester Modular Homes', 'Wingdale, NY', 'Volumetric modular', 'Established Northeast dealer and delivery network'],
      ['Avalon Building Systems', 'Massachusetts', 'Modular', 'Already serves Cape Cod, Nantucket and Martha’s Vineyard'],
    ],
    y: y + 0.06, colW: [2.35, 1.60, 2.20, 3.50], boldFirst: true
  });
  const y16 = y + 0.06 + t16 + 0.26;
  dataTable(s, {
    bandTitle: 'Organisation, Year One',
    head: ['Role', 'Responsibility', 'Timing', 'Loaded cost'],
    rows: [
      ['Design and product lead', 'Standard designs, owner presentation, brand', 'Founder', '$110,000'],
      ['Construction Supervisor, MA licensed', 'Permitting, site work, subcontractors, delivery', 'Month 1', '$135,000'],
      ['Development and financing lead', 'Referral channels, subsidy assembly, close', 'Month 3', '$100,000'],
    ],
    y: y16, colW: [2.75, 3.85, 1.45, 1.60], boldFirst: true
  });
  footnote(s, 'Note: manufacturer list is a candidate screen, not a commitment. Each requires a BBRS registered Third Party Inspection Agency and Massachusetts certification before any order is placed.', 6.48);
  chrome(s);
}

/* ===================== 17. GO TO MARKET ===================== */
{
  const s = p.addSlide();
  title(s, 'GO TO MARKET: CHANNEL BY SEGMENT');
  const y = takeaway(s, [
    'At approximately $83,000 of contribution per contract the business can support a customer acquisition cost far above adjacent trades. Residential solar pays $3,000 to $7,000 per sale on roughly $10,000 of gross profit.',
    'That capacity should be spent on professional referral cultivation and seminars rather than on paid advertising, because referral channels in comparable trades run $300 to $600 per acquired customer against $800 to $1,500 for digital leads.',
    'We will run one segment at a time. Eldercare in year one, then downsize in place, which reuses approximately 70% of the same channels.'
  ]);
  const t17 = dataTable(s, {
    bandTitle: 'Primary Channels and Message by Segment',
    head: ['Segment', 'Lead message', 'Primary channels', 'Target CAC'],
    rows: [
      ['Eldercare', 'Keep your mother close, not in a facility, for less than five years of what a facility costs',
       'Elder law attorneys, geriatric care managers, 350 municipal Councils on Aging, hospital discharge planners', '$4,000'],
      ['Downsize in place', 'Do not sell your house. Rent it, and move forty feet',
       'Realtor dead lead files, financial advisers, Councils on Aging, targeted direct mail to owners aged 60 plus', '$5,000'],
      ['Investor', 'A second door on land you already own, with no owner occupancy requirement',
       'Public Massachusetts ADU yield map, investor associations, DSCR and construction lenders', '$3,000'],
    ],
    y: y + 0.06, colW: [1.70, 3.15, 3.55, 1.25], boldFirst: true
  });
  const y17 = y + 0.06 + t17 + 0.26;
  dataTable(s, {
    bandTitle: 'The Feasibility Screen: One Asset Serving All Three Segments',
    head: ['Input', 'Output', 'Commercial purpose'],
    rows: [
      ['Property address', 'Lot eligibility, sewer status, maximum buildable size', 'Qualifies and disqualifies leads at zero marginal cost'],
      ['Intended use', 'Recommended unit, cost range, delivery date', 'Converts an open ended enquiry into a defined product'],
      ['Owner profile', 'Programmes that stack and net cash required', 'Establishes credibility in every referral conversation'],
    ],
    y: y17, colW: [2.00, 3.80, 3.85], boldFirst: true
  });
  footnote(s, 'Sources: Wood Mackenzie residential solar customer acquisition cost, 2026; Massachusetts Councils on Aging; Massachusetts Aging Services Network. Solar acquisition benchmarks are directional analogues only.', 6.55);
  chrome(s);
}

/* ===================== 18. COMPANY ECONOMICS ===================== */
{
  const s = p.addSlide();
  title(s, 'COMPANY ECONOMICS AND BREAKEVEN');
  const y = takeaway(s, [
    'Contribution per contract is $83,000, comprising a 20% gross margin on a $376,000 design build contract plus an $8,000 permitting and financing coordination fee.',
    'Company breakeven sits at 5.4 units per year against $450,000 of first year fixed overhead, which we believe is achievable in year two given 1,200 ADUs were approved statewide in the first year of the new regulation.',
    'The plan turns profitable in year two and generates $1,375,000 of operating income by year four, at which point volume requires operating across the whole of eastern Massachusetts rather than a single metropolitan submarket.'
  ]);
  dataTable(s, {
    bandTitle: 'Four Year Operating Plan',
    head: ['', 'Year 1', 'Year 2', 'Year 3', 'Year 4'],
    rows: [
      ['Units delivered', '3', '8', '15', '25'],
      ['Revenue at $376,000 per unit', '$1,128,000', '$3,008,000', '$5,640,000', '$9,400,000'],
      ['Gross margin at 20%', '$225,600', '$601,600', '$1,128,000', '$1,880,000'],
      ['Coordination fees at $8,000 per unit', '$24,000', '$64,000', '$120,000', '$200,000'],
      ['Total contribution', '$249,600', '$665,600', '$1,248,000', '$2,080,000'],
      ['Fixed overhead', '($450,000)', '($475,000)', '($550,000)', '($700,000)'],
      ['Operating income', '($200,400)', '$190,600', '$698,000', '$1,380,000'],
      ['Operating margin', '(17.8%)', '6.3%', '12.4%', '14.7%'],
    ],
    y: y + 0.06, colW: [3.25, 1.60, 1.60, 1.60, 1.60], boldFirst: true,
    heat: { 6: { 1: LT_RED, 2: LT_GREEN, 3: LT_GREEN, 4: LT_GREEN } }
  });
  s.addShape(p.ShapeType.rect, { x: M, y: 5.50, w: CW, h: 0.52, fill: { color: NAVY_BAND }, line: { color: NAVY_BAND, width: 0 } });
  s.addText('Breakeven volume: $450,000 of fixed overhead divided by $83,000 of contribution per unit equals 5.4 units per year. Capital requirement of $750,000 funds 18 months of overhead, factory deposits and working capital.', {
    x: M + 0.12, y: 5.50, w: CW - 0.24, h: 0.52, fontFace: F, fontSize: 10, color: WHITE, bold: true,
    align: 'left', valign: 'middle', isTextBox: true, margin: 0
  });
  footnote(s, 'Note: fixed overhead comprises three fully loaded staff, general liability, builders risk and errors and omissions insurance, legal and professional fees, software and office. Illustrative and modelled.', 6.25);
  chrome(s);
}

/* ===================== 19. MILESTONES ===================== */
{
  const s = p.addSlide();
  title(s, 'MILESTONES AND USE OF CAPITAL');
  const y = takeaway(s, [
    'The first twelve months are a diligence and first build programme rather than a volume programme, and we would not sign a second contract before the first unit has a certificate of occupancy.',
    'The three gating items are real manufacturer pricing, a parcel level eligibility screen, and the first completed unit, because every figure in this plan depends on a delivered cost we have not yet validated.',
    'Capital of $750,000 covers 18 months of overhead, factory deposits and working capital, and is sized to reach the second year of positive operating income without a further raise.'
  ]);
  const t19 = dataTable(s, {
    bandTitle: 'Twelve Month Milestone Plan',
    head: ['Months', 'Milestone', 'Output', 'Gating'],
    rows: [
      ['1 to 2', 'Manufacturer pricing from three certified builders', 'Validated delivered cost per sq ft', 'Yes'],
      ['1 to 3', 'Parcel level eligibility and sewer screen, target towns', 'Defensible addressable lot count', 'Yes'],
      ['2 to 5', 'Standard designs A to D and feasibility screen live', 'Four priced products, inbound qualification', 'No'],
      ['3 to 6', 'Referral spine: 20 elder law attorneys, 10 Councils on Aging', 'Qualified eldercare pipeline', 'No'],
      ['4 to 10', 'First unit delivered to certificate of occupancy', 'Reference project and validated cost', 'Yes'],
      ['10 to 12', 'Units two and three under contract', 'Evidence of repeatability', 'No'],
    ],
    y: y + 0.06, colW: [1.25, 3.85, 3.10, 1.45], boldFirst: true
  });
  const y19 = y + 0.06 + t19 + 0.26;
  dataTable(s, {
    bandTitle: 'Use of Capital',
    head: ['Application', 'Amount', '% of total'],
    rows: [
      ['Fixed overhead, 18 months', '$525,000', '70.0%'],
      ['Factory deposits and working capital', '$150,000', '20.0%'],
      ['Design, legal, insurance and tooling', '$75,000', '10.0%'],
      ['Total capital requirement', '$750,000', '100.0%'],
    ],
    y: y19, colW: [5.65, 2.00, 2.00], boldFirst: true, totalRow: true
  });
  footnote(s, 'Note: illustrative and modelled. The plan assumes no revenue before month 10 and no second contract before the first unit reaches certificate of occupancy.', 6.55);
  chrome(s);
}

/* ===================== 20. RISKS ===================== */
{
  const s = p.addSlide();
  title(s, 'KEY RISKS AND MITIGANTS');
  const y = labelBullets(s, [
    { label: 'COST BASIS', bullets: [
      'Risk: we view delivered cost as the largest exposure in the plan, because every return shown depends on a $376,000 project cost not yet validated against a manufacturer quote.',
      'Mitigant: obtain budget pricing from three certified manufacturers before any capital is deployed, and price the sanitary and utility scope inside the contract rather than as an allowance.'
    ]},
    { label: 'RENT SOFTENING', bullets: [
      'Risk: we think the investor segment is genuinely exposed, given Massachusetts vacancy has moved from 3.40% to 4.90% and Greater Boston rent growth has fallen to 1.04%.',
      'Mitigant: eldercare is prioritised precisely because its comparison is a facility bill rather than a rent roll, and the $2,909 monthly rent screen is held even in a slow quarter.'
    ]},
    { label: 'SUBSIDY DEPTH', bullets: [
      'Risk: the MassHousing pool is $5,000,000, funding roughly twenty detached units, and both programmes are annual and discretionary.',
      'Mitigant: the base product is underwritten to clear its hurdle without any subsidy, and programme capital is treated as an accelerant to close rates rather than a requirement.'
    ]},
    { label: 'COMPETITION', bullets: [
      'Risk: we believe the market will be contested, as Massachusetts already supports established design build and modular competitors and a by right regime invites entrants.',
      'Mitigant: the defensible position is the assembled subsidy stack, the pre reviewed standard design and the delivery date, not the architecture, which is replicable.'
    ]},
    { label: 'EXECUTION', bullets: [
      'Risk: a highly visible failure on the first unit would be disproportionately damaging given the referral led go to market.',
      'Mitigant: the first project is run on a cooperative sewered site with a fully pre screened utility path, priced as a reference project, with no second contract signed until it completes.'
    ]},
  ], BODY_TOP);
  footnote(s, 'Note: this page uses the analytical voice. All quantitative claims elsewhere in this document are illustrative and modelled unless a source is cited.', 6.62);
  chrome(s);
}

p.writeFile({ fileName: 'plinth-ma-adu-business-plan.pptx' }).then(f => console.log('WROTE', f));
