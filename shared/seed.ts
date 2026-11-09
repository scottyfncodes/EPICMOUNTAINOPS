/**
 * Starter content.
 *
 * Everything here is ILLUSTRATIVE scaffolding so the app can be explored on
 * day one. None of it is an official Epic Mountain Gear procedure:
 *  - every item is `illustrative: true` and status `unverified`
 *  - no proprietary software names or capabilities are asserted
 *  - safety-critical work (binding adjustment, release checks) is never
 *    described step-by-step; it is represented as an explicit UNKNOWN step
 *    that must be captured from authorized training.
 */
import type {
  Department,
  EdgeKind,
  Entity,
  Equipment,
  FlowEdge,
  FlowNode,
  GlossaryEntry,
  Note,
  NodeKind,
  Source,
  System,
  Workflow,
} from './types'

const T = '2026-11-04T12:00:00.000Z'
/** Content v2 — Junior Trade employee field notes. */
const T2 = '2026-11-09T12:00:00.000Z'

const base = { status: 'unverified' as const, illustrative: true, createdAt: T, updatedAt: T, sourceIds: ['src-starter'] }
/** First-hand employee field notes: Observed, never Verified, never illustrative. */
const field = { status: 'observed' as const, illustrative: false, createdAt: T2, updatedAt: T2, sourceIds: ['src-jrt-field-notes'] }
const JT_URL = 'https://www.epicmountaingear.com/pages/junior-trade'

function n(id: string, kind: NodeKind, label: string, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, kind, label, ...extra }
}
function e(source: string, target: string, kind: EdgeKind = 'normal', label?: string): FlowEdge {
  return { id: `${source}->${target}`, source, target, kind, ...(label ? { label } : {}) }
}

const ASTM_SAFETY =
  'Safety-critical. Binding testing and documentation follow current approved shop and manufacturer procedures only. This atlas holds no release values, torque specifications, adjustment instructions or test requirements — never use it as that reference.'

const SAFETY =
  'Safety-critical. This app does not describe how to perform this work. Follow only authorized training, manufacturer instructions and the procedures you have been certified on.'

/* ------------------------------------------------------------------ */
/* Sources                                                            */
/* ------------------------------------------------------------------ */
const sources: Source[] = [
  {
    ...base,
    id: 'src-starter',
    type: 'source',
    kind: 'other',
    title: 'Illustrative starter content',
    description:
      'Placeholder structure generated to make the app explorable. Not an official source. Replace or confirm each item with first-hand observation or authorized material.',
    authorized: false,
  },
  {
    ...field,
    id: 'src-jrt-field-notes',
    type: 'source',
    kind: 'firsthand',
    title: 'Employee field notes — Junior Trade counter',
    date: '2026-11-09',
    description:
      'First-hand notes from an employee on how a Junior Trade fitting runs at the counter, with pro tips and approximate prices. Not an official procedure: prices are estimates, and safety-critical work must come from approved training.',
    authorized: false,
  },
  {
    ...field,
    status: 'unverified',
    sourceIds: [],
    id: 'src-jrt-website',
    type: 'source',
    kind: 'document',
    title: 'Junior Trade — public program page',
    url: JT_URL,
    date: '2026-11-09',
    description:
      'The public Junior Trade page describes trade-in credit of 50% of the original purchase price toward larger equipment. Public pages change — confirm eligibility, current pricing and terms in store before quoting them as policy.',
    authorized: false,
  },
]

/* ------------------------------------------------------------------ */
/* Systems & programs — deliberately unnamed                          */
/* ------------------------------------------------------------------ */
const systems: System[] = [
  {
    ...base,
    id: 'sys-reservations',
    type: 'system',
    kind: 'software',
    title: 'Reservation lookup (name TBD)',
    summary: 'Wherever pre-booked rentals are found at the counter.',
    description:
      'Placeholder for the system used to find a customer’s advance reservation. The actual product name, screens and capabilities have not been captured yet.',
    purpose: 'Find and confirm a pre-booked rental.',
    departmentIds: ['dept-ski', 'dept-snowboard'],
    inputs: ['Customer identifier (exact field unknown)'],
    outputs: ['Reservation details (exact contents unknown)'],
    whenUsed: 'At intake, when a customer says they have a reservation.',
  },
  {
    ...base,
    id: 'sys-rental-record',
    type: 'system',
    kind: 'software',
    title: 'Rental transaction record (name TBD)',
    summary: 'Where a rental is created, updated, issued and checked back in.',
    description:
      'Placeholder for the system that holds the rental transaction. It may be the same product as reservation lookup — unconfirmed.',
    purpose: 'Record who has which equipment and its status.',
    departmentIds: ['dept-ski', 'dept-snowboard'],
    inputs: ['Customer information', 'Equipment assigned'],
    outputs: ['Rental record', 'Return / check-in status'],
    whenUsed: 'Intake, issuance and returns.',
  },
  {
    ...base,
    id: 'sys-binding-reference',
    type: 'system',
    kind: 'reference',
    title: 'Binding setting reference (format TBD)',
    summary: 'The authorized reference used to determine binding settings.',
    description:
      'Release settings are determined from an authorized reference (in the industry this may be a chart or software). Which reference is used here, and who may use it, has not been captured. Do not use this app as that reference.',
    purpose: 'Determine binding settings — safety-critical.',
    departmentIds: ['dept-ski', 'dept-jr-trades'],
    inputs: ['Customer details required by the reference (unconfirmed)', 'Boot sole length'],
    outputs: ['Setting determined by the authorized reference'],
    whenUsed: 'Before skis are issued. Exact point in the process unconfirmed.',
  },
  {
    ...base,
    id: 'sys-inventory',
    type: 'system',
    kind: 'software',
    title: 'Equipment inventory tracking (TBD)',
    summary: 'How equipment availability and condition are tracked.',
    description: 'Placeholder. It is unknown whether inventory is tracked in software, on paper, or in the rental system itself.',
    purpose: 'Know what equipment is available, out, or in repair.',
    departmentIds: ['dept-ski', 'dept-snowboard', 'dept-jr-trades'],
    inputs: ['Item status changes'],
    outputs: ['Available / out / in-repair counts'],
    whenUsed: 'Unknown.',
  },
  {
    ...base,
    id: 'sys-repair-tag',
    type: 'system',
    kind: 'process',
    title: 'Repair tag / work order (format TBD)',
    summary: 'How a problem item is flagged and handed to the shop.',
    description: 'Placeholder for the tag, form or digital record used to send equipment for repair.',
    purpose: 'Get damaged equipment out of circulation and to the right technician.',
    departmentIds: ['dept-ski', 'dept-snowboard', 'dept-jr-trades'],
    inputs: ['Item', 'Description of the issue'],
    outputs: ['Item queued for repair'],
    whenUsed: 'When a return or inspection finds an issue.',
  },
  {
    ...field,
    id: 'sys-jrt-checkin',
    type: 'system',
    kind: 'software',
    title: 'Junior Trade check-in computer (name pending identification)',
    summary: 'Where families are checked in and appointments are found.',
    description:
      'The computer system used at the Junior Trade counter to check guests in. Its product name and screens have not been identified yet. Field note: appointment details sometimes include the child’s height and weight, entered by the parent when booking.',
    purpose: 'Check the family in and see what the parent entered when booking.',
    departmentIds: ['dept-jr-trades'],
    inputs: ['Guest / appointment lookup (exact fields not captured)'],
    outputs: ['Checked-in guest', 'Appointment details — sometimes the child’s height and weight'],
    whenUsed: 'Guest arrival, before fitting starts.',
  },
  {
    ...field,
    id: 'sys-jrt-parent-form',
    type: 'system',
    kind: 'software',
    title: 'Parent form on the iPad (app pending identification)',
    summary: 'The paperwork the parent completes on a shop iPad during fitting.',
    description:
      'A form opened on a shop iPad for the parent to complete while the child is fitted; the selected equipment is entered on it afterwards. The app name and the form’s fields have not been identified yet.',
    purpose: 'Collect the parent’s paperwork and record the selected equipment.',
    departmentIds: ['dept-jr-trades'],
    inputs: ['Parent’s details (fields not captured)', 'Selected equipment'],
    outputs: ['Completed parent paperwork'],
    whenUsed: 'Started before boot sizing; finished when the iPad is retrieved and equipment entered.',
  },
  {
    ...field,
    id: 'sys-jrt-astm-record',
    type: 'system',
    kind: 'process',
    title: 'ASTM authorization & signature record (format pending identification)',
    summary: 'Where ASTM authorization, testing documentation and the parent’s final signature are recorded.',
    description:
      'Safety-critical documentation. Whether this is paper, the iPad form or another system has not been identified. Record it exactly as approved procedures require.',
    purpose: 'Document that required binding testing and sign-offs are complete before release.',
    departmentIds: ['dept-jr-trades'],
    inputs: ['ASTM authorization / sign-off', 'Binding test documentation', 'Parent’s final ASTM signature'],
    outputs: ['Complete documentation — required before equipment is released'],
    whenUsed: 'After equipment entry, through to release.',
  },
]

/* ------------------------------------------------------------------ */
/* Equipment — generic industry categories only                       */
/* ------------------------------------------------------------------ */
const eq = (id: string, title: string, category: string, departmentIds: string[], description: string): Equipment => ({
  ...base,
  id,
  type: 'equipment',
  title,
  category,
  departmentIds,
  description,
})

const equipment: Equipment[] = [
  eq('eq-skis', 'Rental skis', 'Ski equipment', ['dept-ski', 'dept-jr-trades'], 'Skis in the rental fleet. Models and sizing ranges not yet captured.'),
  eq('eq-ski-boots', 'Ski boots', 'Ski equipment', ['dept-ski', 'dept-jr-trades'], 'Rental ski boots.'),
  eq('eq-ski-bindings', 'Ski bindings', 'Ski equipment', ['dept-ski', 'dept-jr-trades'], 'Bindings mounted on rental skis. Adjustment is safety-critical.'),
  eq('eq-poles', 'Poles', 'Ski equipment', ['dept-ski'], 'Ski poles.'),
  eq('eq-helmets', 'Helmets', 'Protective', ['dept-ski', 'dept-snowboard'], 'Whether helmets are part of a standard package is unconfirmed.'),
  eq('eq-snowboards', 'Rental snowboards', 'Snowboard equipment', ['dept-snowboard', 'dept-jr-trades'], 'Snowboards in the rental fleet.'),
  eq('eq-snb-boots', 'Snowboard boots', 'Snowboard equipment', ['dept-snowboard', 'dept-jr-trades'], 'Rental snowboard boots.'),
  eq('eq-snb-bindings', 'Snowboard bindings', 'Snowboard equipment', ['dept-snowboard', 'dept-jr-trades'], 'Strap/plate bindings mounted to boards.'),
  eq('eq-foot-measure', 'Foot measuring device', 'Fitting tools', ['dept-ski', 'dept-snowboard'], 'Device used to measure foot length/width. Exact device unconfirmed.'),
  eq('eq-tuning-tools', 'Edge & base tuning tools', 'Shop tools', ['dept-jr-trades'], 'Files, stones, edge guides and similar hand or machine tools. Shop equipment list not yet captured.'),
  eq('eq-wax', 'Wax & waxing iron', 'Shop tools', ['dept-jr-trades'], 'Wax and iron used for base waxing.'),
  { ...eq('eq-ipad', 'Shop iPad', 'Counter devices', ['dept-jr-trades'], 'A shop iPad used for the parent form during Junior Trade fittings.'), ...field, systemIds: ['sys-jrt-parent-form'] },
  eq('eq-base-repair', 'Base repair materials', 'Shop tools', ['dept-jr-trades'], 'Materials for filling base gouges (for example P-tex).'),
]

/* ------------------------------------------------------------------ */
/* Workflows                                                          */
/* ------------------------------------------------------------------ */
const wf = (w: Omit<Workflow, 'type' | 'status' | 'createdAt' | 'updatedAt' | 'illustrative'>): Workflow => ({
  ...base,
  type: 'workflow',
  ...w,
})

const workflows: Workflow[] = [
  /* ---------------- SKI RENTALS ---------------- */
  wf({
    id: 'wf-ski-intake',
    code: 'SKI-01',
    title: 'Customer intake: reservation or walk-in',
    summary: 'From the moment a customer reaches the counter to handing them off for boot fitting.',
    trigger: 'A customer arrives to rent ski equipment.',
    outcome: 'Customer has a rental record with the information needed for fitting.',
    departmentIds: ['dept-ski'],
    systemIds: ['sys-reservations', 'sys-rental-record'],
    equipmentIds: [],
    nodes: [
      n('start', 'start', 'Customer arrives at the counter'),
      n('has-res', 'decision', 'Does the customer have a reservation?', {
        what: 'Ask whether the customer booked in advance.',
        why: 'Reservations and walk-ins likely start from different screens or records.',
        info: 'Customer’s answer. If they have a confirmation, whatever identifier is used to look it up (unconfirmed).',
      }),
      n('lookup', 'step', 'Look up the reservation', {
        what: 'Find the existing reservation in the reservation system.',
        why: 'Avoid re-entering information the customer already provided.',
        who: 'Counter staff (role name unconfirmed).',
        systemIds: ['sys-reservations'],
        info: 'Customer identifier — exact field (name, confirmation number, email…) not yet captured.',
        mistakes: 'Not captured yet.',
      }),
      n('walkin', 'step', 'Start a walk-in rental', {
        what: 'Create a new rental record for a customer without a reservation.',
        systemIds: ['sys-rental-record'],
        info: 'Not yet captured.',
      }),
      n('info', 'step', 'Confirm or collect customer information', {
        what: 'Make sure the record holds everything later steps depend on.',
        why: 'Equipment selection and binding settings depend on customer details. The exact list used here is unconfirmed.',
        info:
          'Commonly collected in the industry: height, weight, age, ability level, boot or shoe size. Confirm the actual required fields before relying on this list.',
        considerations: 'Inaccurate customer details flow into later safety-critical steps. Verify, don’t assume.',
        systemIds: ['sys-rental-record'],
        status: 'unverified',
      }),
      n('agreement', 'unknown', 'Rental agreement / waiver?', {
        what: 'Unknown whether an agreement or waiver is completed here, earlier (online) or later.',
        considerations: 'Capture this from an authorized source.',
      }),
      n('to-boots', 'link', 'Continue to boot fitting', { linkWorkflowId: 'wf-ski-boot-fit' }),
    ],
    edges: [
      e('start', 'has-res'),
      e('has-res', 'lookup', 'yes', 'Yes'),
      e('has-res', 'walkin', 'no', 'No — walk-in'),
      e('lookup', 'info'),
      e('walkin', 'info'),
      e('info', 'agreement'),
      e('agreement', 'to-boots'),
    ],
  }),
  wf({
    id: 'wf-ski-boot-fit',
    code: 'SKI-02',
    title: 'Ski boot fitting',
    summary: 'Measuring, trying on and confirming a boot fit, then recording the boot sole length.',
    trigger: 'Customer information has been collected.',
    outcome: 'Customer has boots that fit; boot sole length is recorded.',
    departmentIds: ['dept-ski'],
    systemIds: ['sys-rental-record'],
    equipmentIds: ['eq-ski-boots', 'eq-foot-measure'],
    nodes: [
      n('start', 'start', 'Customer ready for boots'),
      n('measure', 'step', 'Measure the foot', {
        what: 'Measure foot length (and possibly width).',
        why: 'Gives a starting size rather than guessing from street-shoe size.',
        equipmentIds: ['eq-foot-measure'],
        info: 'Foot measurement. Sizing scale used (e.g. Mondopoint) unconfirmed.',
      }),
      n('pick', 'step', 'Select a starting boot size', { equipmentIds: ['eq-ski-boots'] }),
      n('tryon', 'step', 'Customer tries on the boots', {
        what: 'Customer puts boots on, buckles them and stands in a flexed stance.',
        mistakes: 'Not captured yet.',
      }),
      n('fit-ok', 'decision', 'Is the fit acceptable?'),
      n('adjust', 'step', 'Try a different size or model'),
      n('bsl', 'step', 'Record the boot sole length (BSL)', {
        what: 'Note the BSL printed on the boot shell.',
        why: 'BSL is used when bindings are set up for that boot.',
        systemIds: ['sys-rental-record'],
        info: 'BSL in millimetres, from the boot shell.',
        considerations: 'Where and how BSL is recorded locally is unconfirmed.',
      }),
      n('to-skis', 'link', 'Continue to ski selection & bindings', { linkWorkflowId: 'wf-ski-select' }),
    ],
    edges: [
      e('start', 'measure'),
      e('measure', 'pick'),
      e('pick', 'tryon'),
      e('tryon', 'fit-ok'),
      e('fit-ok', 'adjust', 'no', 'No'),
      e('adjust', 'tryon', 'loop', 'Try again'),
      e('fit-ok', 'bsl', 'yes', 'Yes'),
      e('bsl', 'to-skis'),
    ],
  }),
  wf({
    id: 'wf-ski-select',
    code: 'SKI-03',
    title: 'Ski selection & binding adjustment',
    summary: 'Choosing skis, then the safety-critical binding work — which is intentionally not described here.',
    trigger: 'Boots fitted and BSL recorded.',
    outcome: 'Skis ready to issue with bindings set by an authorized person.',
    departmentIds: ['dept-ski', 'dept-jr-trades'],
    systemIds: ['sys-binding-reference', 'sys-rental-record'],
    equipmentIds: ['eq-skis', 'eq-ski-bindings'],
    nodes: [
      n('start', 'start', 'Boots fitted'),
      n('choose', 'step', 'Select ski type and length', {
        what: 'Choose skis appropriate for the customer.',
        info: 'Typically ability, height and weight in the industry. Local sizing guidance not captured.',
        equipmentIds: ['eq-skis'],
      }),
      n('warn', 'warning', 'Binding work is safety-critical', {
        what: SAFETY,
        considerations: 'Only staff authorized for binding work should perform or check it.',
        equipmentIds: ['eq-ski-bindings'],
      }),
      n('adjust', 'unknown', 'Binding adjustment — capture from authorized training', {
        what: 'The actual procedure has not been captured. Add it only from an authorized source.',
        systemIds: ['sys-binding-reference'],
        equipmentIds: ['eq-ski-bindings'],
      }),
      n('check', 'unknown', 'Check / sign-off — who and how?', {
        what: 'Unknown whether a second check or sign-off is required, and by whom.',
      }),
      n('to-issue', 'link', 'Continue to equipment issuance', { linkWorkflowId: 'wf-ski-issue' }),
    ],
    edges: [e('start', 'choose'), e('choose', 'warn'), e('warn', 'adjust'), e('adjust', 'check'), e('check', 'to-issue')],
  }),
  wf({
    id: 'wf-ski-issue',
    code: 'SKI-04',
    title: 'Equipment issuance',
    summary: 'Assembling the customer’s package and handing it over.',
    trigger: 'Skis and boots are ready.',
    outcome: 'Customer leaves with their equipment; rental shows as out.',
    departmentIds: ['dept-ski'],
    systemIds: ['sys-rental-record', 'sys-inventory'],
    equipmentIds: ['eq-skis', 'eq-ski-boots', 'eq-poles', 'eq-helmets'],
    nodes: [
      n('start', 'start', 'Package ready to assemble'),
      n('fork', 'parallel', 'Assemble in parallel'),
      n('skis', 'step', 'Skis', { equipmentIds: ['eq-skis'] }),
      n('boots', 'step', 'Boots', { equipmentIds: ['eq-ski-boots'] }),
      n('poles', 'step', 'Poles', { equipmentIds: ['eq-poles'] }),
      n('helmet', 'step', 'Helmet (if part of the rental?)', { equipmentIds: ['eq-helmets'], status: 'unverified' }),
      n('join', 'parallel', 'Package complete'),
      n('handoff', 'step', 'Hand off to the customer', {
        what: 'Give the customer their equipment.',
        info: 'What is explained at handoff (return time, location…) is not yet captured.',
      }),
      n('mark-out', 'step', 'Mark equipment as out', { systemIds: ['sys-rental-record', 'sys-inventory'] }),
      n('end', 'end', 'Customer departs'),
    ],
    edges: [
      e('start', 'fork'),
      e('fork', 'skis', 'branch'),
      e('fork', 'boots', 'branch'),
      e('fork', 'poles', 'branch'),
      e('fork', 'helmet', 'branch'),
      e('skis', 'join', 'branch'),
      e('boots', 'join', 'branch'),
      e('poles', 'join', 'branch'),
      e('helmet', 'join', 'branch'),
      e('join', 'handoff'),
      e('handoff', 'mark-out'),
      e('mark-out', 'end'),
    ],
  }),
  wf({
    id: 'wf-ski-return',
    code: 'SKI-05',
    title: 'Equipment return',
    summary: 'Checking equipment back in and routing problems to the shop.',
    trigger: 'A customer brings equipment back.',
    outcome: 'Item is either available again or queued for repair.',
    departmentIds: ['dept-ski', 'dept-jr-trades'],
    systemIds: ['sys-rental-record', 'sys-repair-tag', 'sys-inventory'],
    equipmentIds: ['eq-skis', 'eq-ski-boots', 'eq-poles'],
    nodes: [
      n('start', 'start', 'Customer returns equipment'),
      n('find', 'step', 'Locate the rental record', { systemIds: ['sys-rental-record'] }),
      n('checkin', 'step', 'Check in each item', { systemIds: ['sys-rental-record'], mistakes: 'Not captured yet.' }),
      n('condition', 'step', 'Quick condition check', { what: 'Look for obvious damage before the item goes back into stock.' }),
      n('damage', 'decision', 'Damage or issue found?'),
      n('tag', 'step', 'Tag the item and describe the issue', { systemIds: ['sys-repair-tag'] }),
      n('to-shop', 'link', 'Hand off to repair intake', { linkWorkflowId: 'wf-jrt-repair' }),
      n('clean', 'step', 'Clean / dry and put away', { what: 'Storage locations and drying process not captured.' }),
      n('end', 'end', 'Item back in available inventory', { systemIds: ['sys-inventory'] }),
    ],
    edges: [
      e('start', 'find'),
      e('find', 'checkin'),
      e('checkin', 'condition'),
      e('condition', 'damage'),
      e('damage', 'tag', 'yes', 'Yes'),
      e('tag', 'to-shop'),
      e('damage', 'clean', 'no', 'No'),
      e('clean', 'end'),
    ],
  }),

  /* ---------------- SNOWBOARD RENTALS ---------------- */
  wf({
    id: 'wf-snb-intake',
    code: 'SNB-01',
    title: 'Customer intake (snowboard)',
    summary: 'Reservation or walk-in, plus the details snowboard setup depends on.',
    trigger: 'A customer arrives to rent snowboard equipment.',
    outcome: 'Customer has a rental record ready for boot fitting.',
    departmentIds: ['dept-snowboard'],
    systemIds: ['sys-reservations', 'sys-rental-record'],
    equipmentIds: [],
    nodes: [
      n('start', 'start', 'Customer arrives at the counter'),
      n('has-res', 'decision', 'Does the customer have a reservation?'),
      n('lookup', 'step', 'Look up the reservation', { systemIds: ['sys-reservations'] }),
      n('walkin', 'step', 'Start a walk-in rental', { systemIds: ['sys-rental-record'] }),
      n('info', 'step', 'Confirm or collect customer information', {
        info: 'Likely: height, weight, ability, boot size, and stance (regular or goofy) if the rider knows it. Confirm the actual list.',
        systemIds: ['sys-rental-record'],
      }),
      n('to-boots', 'link', 'Continue to boots & board', { linkWorkflowId: 'wf-snb-setup' }),
    ],
    edges: [
      e('start', 'has-res'),
      e('has-res', 'lookup', 'yes', 'Yes'),
      e('has-res', 'walkin', 'no', 'No — walk-in'),
      e('lookup', 'info'),
      e('walkin', 'info'),
      e('info', 'to-boots'),
    ],
  }),
  wf({
    id: 'wf-snb-setup',
    code: 'SNB-02',
    title: 'Boot fitting & board setup',
    summary: 'Fit boots, choose a board, determine stance and set up bindings.',
    trigger: 'Intake complete.',
    outcome: 'Board set up for the rider and ready to issue.',
    departmentIds: ['dept-snowboard'],
    systemIds: ['sys-rental-record'],
    equipmentIds: ['eq-snb-boots', 'eq-snowboards', 'eq-snb-bindings', 'eq-foot-measure'],
    nodes: [
      n('start', 'start', 'Customer ready for boots'),
      n('fit', 'step', 'Fit snowboard boots', { equipmentIds: ['eq-snb-boots', 'eq-foot-measure'] }),
      n('fit-ok', 'decision', 'Is the fit acceptable?'),
      n('refit', 'step', 'Try a different size or model'),
      n('board', 'step', 'Select board size', {
        info: 'In the industry: rider weight, height, boot size and ability. Local sizing guidance not captured.',
        equipmentIds: ['eq-snowboards'],
      }),
      n('stance', 'step', 'Determine stance: regular or goofy', {
        what: 'Determine which foot the rider leads with.',
        info: 'If the rider doesn’t know, how it is determined here is not yet captured.',
      }),
      n('setup', 'step', 'Set up bindings for the stance', {
        what: 'Mount/adjust bindings for the rider’s stance.',
        considerations: 'Standard stance width and angles used here are not captured. Do not guess values.',
        equipmentIds: ['eq-snb-bindings'],
      }),
      n('hw', 'warning', 'Confirm hardware is secure', {
        what: 'How hardware is checked, and by whom, has not been captured. Follow authorized training.',
      }),
      n('to-issue', 'link', 'Continue to issuance & return', { linkWorkflowId: 'wf-snb-return' }),
    ],
    edges: [
      e('start', 'fit'),
      e('fit', 'fit-ok'),
      e('fit-ok', 'refit', 'no', 'No'),
      e('refit', 'fit', 'loop', 'Try again'),
      e('fit-ok', 'board', 'yes', 'Yes'),
      e('board', 'stance'),
      e('stance', 'setup'),
      e('setup', 'hw'),
      e('hw', 'to-issue'),
    ],
  }),
  wf({
    id: 'wf-snb-return',
    code: 'SNB-03',
    title: 'Snowboard issuance & return',
    summary: 'Handing over the setup and checking it back in later.',
    trigger: 'Board set up.',
    outcome: 'Equipment returned to inventory or routed for repair.',
    departmentIds: ['dept-snowboard', 'dept-jr-trades'],
    systemIds: ['sys-rental-record', 'sys-repair-tag', 'sys-inventory'],
    equipmentIds: ['eq-snowboards', 'eq-snb-boots', 'eq-helmets'],
    nodes: [
      n('start', 'start', 'Setup complete'),
      n('handoff', 'step', 'Hand off to the customer', { systemIds: ['sys-rental-record'] }),
      n('out', 'step', 'Customer rides', { what: 'Rental period. Duration rules not captured.' }),
      n('back', 'step', 'Customer returns equipment'),
      n('checkin', 'step', 'Check in each item', { systemIds: ['sys-rental-record'] }),
      n('damage', 'decision', 'Damage or issue found?'),
      n('tag', 'step', 'Tag and describe the issue', { systemIds: ['sys-repair-tag'] }),
      n('to-shop', 'link', 'Hand off to repair intake', { linkWorkflowId: 'wf-jrt-repair' }),
      n('end', 'end', 'Back in available inventory', { systemIds: ['sys-inventory'] }),
    ],
    edges: [
      e('start', 'handoff'),
      e('handoff', 'out'),
      e('out', 'back'),
      e('back', 'checkin'),
      e('checkin', 'damage'),
      e('damage', 'tag', 'yes', 'Yes'),
      e('tag', 'to-shop'),
      e('damage', 'end', 'no', 'No'),
    ],
  }),

  /* ---------------- JR TRADES ---------------- */
  wf({
    id: 'wf-jrt-repair',
    code: 'JRT-01',
    title: 'Repair intake & triage',
    summary: 'Receiving a tagged item, deciding what it needs and routing it.',
    trigger: 'An item is tagged at returns or inspection.',
    outcome: 'Item is repaired and returned to inventory, or removed from the fleet.',
    departmentIds: ['dept-jr-trades', 'dept-ski', 'dept-snowboard'],
    systemIds: ['sys-repair-tag', 'sys-inventory'],
    equipmentIds: ['eq-tuning-tools', 'eq-base-repair'],
    nodes: [
      n('start', 'start', 'Tagged item arrives'),
      n('read', 'step', 'Receive item & read the tag', { systemIds: ['sys-repair-tag'] }),
      n('inspect', 'step', 'Initial inspection', { what: 'Confirm the reported issue and look for anything else.' }),
      n('type', 'decision', 'What kind of issue?'),
      n('base', 'step', 'Base / edge repair', { equipmentIds: ['eq-tuning-tools', 'eq-base-repair'] }),
      n('bind-warn', 'warning', 'Binding issue — safety-critical', { what: SAFETY, equipmentIds: ['eq-ski-bindings', 'eq-snb-bindings'] }),
      n('bind', 'unknown', 'Binding repair & check — capture from authorized training'),
      n('boot', 'step', 'Boot repair / adjustment', { equipmentIds: ['eq-ski-boots', 'eq-snb-boots'], what: 'Types of boot repairs done here not captured.' }),
      n('retire', 'unknown', 'Not repairable — retirement process?', { what: 'How items are removed from the fleet is unknown.' }),
      n('qc', 'step', 'Quality check', { who: 'Unknown — confirm who signs off.' }),
      n('end', 'end', 'Return to available inventory', { systemIds: ['sys-inventory'] }),
      n('gone', 'end', 'Removed from fleet'),
    ],
    edges: [
      e('start', 'read'),
      e('read', 'inspect'),
      e('inspect', 'type'),
      e('type', 'base', 'branch', 'Base / edge'),
      e('type', 'bind-warn', 'branch', 'Binding'),
      e('type', 'boot', 'branch', 'Boot'),
      e('type', 'retire', 'branch', 'Beyond repair'),
      e('bind-warn', 'bind'),
      e('base', 'qc'),
      e('bind', 'qc'),
      e('boot', 'qc'),
      e('qc', 'end'),
      e('retire', 'gone'),
    ],
  }),
  wf({
    id: 'wf-jrt-tune',
    code: 'JRT-02',
    title: 'Routine tune & wax cycle',
    summary: 'A general base/edge maintenance cycle. Local process and schedule not yet captured.',
    trigger: 'Equipment is due for service (how this is decided is unknown).',
    outcome: 'Equipment tuned, waxed and back in rotation.',
    departmentIds: ['dept-jr-trades'],
    systemIds: ['sys-inventory'],
    equipmentIds: ['eq-tuning-tools', 'eq-wax', 'eq-skis', 'eq-snowboards'],
    nodes: [
      n('start', 'start', 'Equipment due for service'),
      n('pull', 'step', 'Pull equipment for service', { what: 'Criteria and schedule unknown.' }),
      n('clean', 'step', 'Clean the base'),
      n('edge', 'step', 'Edge tune', { equipmentIds: ['eq-tuning-tools'] }),
      n('wax', 'step', 'Wax', { equipmentIds: ['eq-wax'] }),
      n('finish', 'step', 'Scrape & brush'),
      n('inspect', 'link', 'Inspection checkpoint', { linkWorkflowId: 'wf-jrt-inspect' }),
    ],
    edges: [e('start', 'pull'), e('pull', 'clean'), e('clean', 'edge'), e('edge', 'wax'), e('wax', 'finish'), e('finish', 'inspect')],
  }),
  wf({
    id: 'wf-jrt-inspect',
    code: 'JRT-03',
    title: 'Equipment inspection checkpoint',
    summary: 'A structured look at each part of an item before it returns to the fleet.',
    trigger: 'After service, or when an item is flagged.',
    outcome: 'Item cleared, or routed to repair.',
    departmentIds: ['dept-jr-trades'],
    systemIds: ['sys-repair-tag'],
    equipmentIds: ['eq-skis', 'eq-snowboards', 'eq-ski-boots', 'eq-snb-boots'],
    nodes: [
      n('start', 'start', 'Item ready for inspection'),
      n('fork', 'parallel', 'Inspect each area'),
      n('base', 'step', 'Base & edges'),
      n('top', 'step', 'Top sheet & sidewalls'),
      n('bind', 'warning', 'Bindings — authorized check only', { what: SAFETY }),
      n('boots', 'step', 'Boots: buckles, liners, soles'),
      n('join', 'parallel', 'All areas reviewed'),
      n('pass', 'decision', 'Passes inspection?'),
      n('ok', 'end', 'Cleared for rental'),
      n('fix', 'link', 'Send to repair intake', { linkWorkflowId: 'wf-jrt-repair' }),
    ],
    edges: [
      e('start', 'fork'),
      e('fork', 'base', 'branch'),
      e('fork', 'top', 'branch'),
      e('fork', 'bind', 'branch'),
      e('fork', 'boots', 'branch'),
      e('base', 'join', 'branch'),
      e('top', 'join', 'branch'),
      e('bind', 'join', 'branch'),
      e('boots', 'join', 'branch'),
      e('join', 'pass'),
      e('pass', 'ok', 'yes', 'Yes'),
      e('pass', 'fix', 'no', 'No'),
    ],
  }),
  /* ---------------- JUNIOR TRADE (employee field notes) ---------------- */
  {
    ...field,
    type: 'workflow',
    id: 'wf-jrt-fitting',
    code: 'JRT-04',
    title: 'Junior Trade fitting, ASTM & release',
    summary:
      'A family’s Junior Trade visit from arrival to release: check-in, boots, skis, trade-in value, equipment entry, ASTM and the final signature.',
    trigger: 'A family arrives at the Junior Trade counter.',
    outcome: 'Equipment released to the family after every mandatory procedure and signature is complete.',
    source: 'Employee field notes, Nov 2026',
    defaultView: 'guide',
    departmentIds: ['dept-jr-trades'],
    systemIds: ['sys-jrt-checkin', 'sys-jrt-parent-form', 'sys-inventory', 'sys-jrt-astm-record', 'sys-binding-reference'],
    equipmentIds: ['eq-ski-boots', 'eq-skis', 'eq-ski-bindings', 'eq-ipad'],
    nodes: [
      n('start', 'start', 'Family arrives at the Junior Trade counter', { phase: 'Guest arrival' }),
      n('appt', 'decision', 'Do they have an appointment?', {
        phase: 'Guest arrival',
        what: 'Ask the guest whether they booked an appointment.',
        why: 'Booked appointments can already hold details you’ll need for sizing.',
      }),
      n('checkin-appt', 'step', 'Check in from the appointment', {
        phase: 'Guest arrival',
        what: 'Find the appointment and check the family in on the computer.',
        systemIds: ['sys-jrt-checkin'],
        callouts: [
          {
            kind: 'tip',
            text: 'Appointment details sometimes include the child’s height and weight, entered by the parent when booking. Check there if the parent doesn’t know.',
          },
        ],
      }),
      n('checkin-walk', 'step', 'Check in without an appointment', {
        phase: 'Guest arrival',
        what: 'Check the family in on the computer.',
        considerations: 'How guests without an appointment are entered hasn’t been captured yet.',
        systemIds: ['sys-jrt-checkin'],
        status: 'unverified',
      }),
      n('shoes', 'step', 'Shoes off · parent form ready', {
        phase: 'Prepare for fitting',
        what: 'Have the child take their shoes off. Grab an iPad and open the parent form.',
        why: 'Starting the paperwork now means it’s finished by the time the equipment is chosen.',
        systemIds: ['sys-jrt-parent-form'],
        equipmentIds: ['eq-ipad'],
      }),
      n('split', 'parallel', 'Paperwork and sizing run together', { phase: 'Prepare for fitting' }),
      n('form', 'step', 'Parent completes the form on the iPad', {
        phase: 'Prepare for fitting',
        what: 'Hand the iPad to the parent to complete the paperwork while you size boots.',
        who: 'Parent or guardian',
        info: 'The form’s exact fields haven’t been captured.',
        systemIds: ['sys-jrt-parent-form'],
        equipmentIds: ['eq-ipad'],
      }),
      n('boot-size', 'step', 'Determine the child’s boot size', {
        phase: 'Boot fitting',
        what: 'Work out the child’s boot size.',
        considerations: 'How size is measured here (device and sizing scale) hasn’t been captured.',
        equipmentIds: ['eq-ski-boots'],
      }),
      n('boot-stock', 'decision', 'Is that boot size in stock?', {
        phase: 'Boot fitting',
        what: 'Check available inventory for the size.',
        systemIds: ['sys-inventory'],
      }),
      n('boot-out', 'link', 'Boots out of stock — offer the options', {
        phase: 'Boot fitting',
        linkWorkflowId: 'wf-jrt-out-of-stock',
        embed: true,
        callouts: [
          {
            kind: 'estimate',
            text: 'New boots run about $45 more than the base package (about $175). Confirm current pricing before quoting.',
          },
        ],
      }),
      n('goldilocks', 'step', 'Goldilocks fit check', {
        phase: 'Boot fitting',
        what: 'Have the child try the boots on and check the fit is just right — not too big, not too small — including where the big toe sits relative to the front of the boot.',
        why: 'A boot that fits properly is the starting point for everything after it.',
        considerations: 'No exact clearance measurement or formal fit standard has been captured. Follow approved fitting training.',
        equipmentIds: ['eq-ski-boots'],
      }),
      n('fit-ok', 'decision', 'Is the fit just right?', { phase: 'Boot fitting' }),
      n('ski-size', 'step', 'Size the skis', {
        phase: 'Ski sizing',
        what: 'Choose a ski length by the child’s ability, using where the ski tip reaches on the child.',
        info: 'Ability level: beginner, intermediate or advanced.',
        considerations: 'A general field-note range — not a substitute for approved equipment-selection procedures.',
        equipmentIds: ['eq-skis'],
        sizing: [
          { label: 'Beginner', from: 'collarbone', to: 'chin' },
          { label: 'Intermediate', from: 'chin', to: 'nose' },
          { label: 'Advanced', from: 'nose', to: 'top' },
        ],
      }),
      n('ski-stock', 'decision', 'Are skis in that length in stock?', {
        phase: 'Ski sizing',
        what: 'Check available inventory for the length.',
        systemIds: ['sys-inventory'],
      }),
      n('ski-out', 'link', 'Skis out of stock — offer the options', {
        phase: 'Ski sizing',
        linkWorkflowId: 'wf-jrt-out-of-stock',
        embed: true,
        callouts: [
          {
            kind: 'estimate',
            text: 'New skis run about $100 more than the base package. Confirm current pricing before quoting.',
          },
        ],
      }),
      n('tradein', 'step', 'Explain trade-in value', {
        phase: 'Trade-in value',
        what: 'Explain that buying new keeps strong trade-in value for later, when the child moves up to larger equipment.',
        considerations: 'Verify eligibility, current pricing and terms before presenting them as confirmed policy.',
        callouts: [
          {
            kind: 'published',
            text: 'The official Junior Trade page describes trade-in credit of 50% of the original purchase price toward larger equipment.',
            url: JT_URL,
            urlLabel: 'Junior Trade page',
          },
        ],
      }),
      n('join', 'parallel', 'Form complete · equipment chosen', { phase: 'Equipment entry & ASTM authorization' }),
      n('retrieve', 'step', 'Get the iPad back and enter the equipment', {
        phase: 'Equipment entry & ASTM authorization',
        what: 'Retrieve the iPad from the parent and enter the selected equipment.',
        systemIds: ['sys-jrt-parent-form'],
        equipmentIds: ['eq-ipad'],
      }),
      n('authorize', 'step', 'Obtain ASTM authorization', {
        phase: 'Equipment entry & ASTM authorization',
        critical: true,
        what: 'Get the required ASTM authorization / sign-off.',
        who: 'Who may give the authorization hasn’t been captured.',
        systemIds: ['sys-jrt-astm-record'],
      }),
      n('who-astm', 'decision', 'Who runs ASTM?', {
        phase: 'Equipment entry & ASTM authorization',
        what: 'Depending on staffing and approved procedures, either proceed with ASTM yourself or begin fitting the next child.',
      }),
      n('next-child', 'step', 'Start fitting the next child', {
        phase: 'Equipment entry & ASTM authorization',
        what: 'Begin fitting the next child while ASTM is completed under approved procedures.',
        considerations: 'How ASTM is passed to a teammate hasn’t been captured.',
        status: 'unverified',
      }),
      n('astm-warn', 'warning', 'ASTM is safety-critical', {
        phase: 'ASTM procedure',
        critical: true,
        what: ASTM_SAFETY,
        considerations: 'Only staff trained and authorized under current procedures perform or check this work.',
        equipmentIds: ['eq-ski-bindings'],
      }),
      n('astm', 'unknown', 'ASTM binding test & documentation', {
        phase: 'ASTM procedure',
        critical: true,
        what: 'Perform the required binding testing and documentation exactly as current approved shop and manufacturer procedures specify.',
        considerations: 'No approved internal ASTM procedure has been captured in this atlas yet. Add one only from an authorized source.',
        systemIds: ['sys-binding-reference', 'sys-jrt-astm-record'],
        equipmentIds: ['eq-ski-bindings'],
        relatedWorkflowIds: ['wf-ski-select'],
      }),
      n('signature', 'step', 'Parent’s final ASTM signature', {
        phase: 'Final signature & release',
        critical: true,
        what: 'Have the parent give their final ASTM signature.',
        who: 'Parent or guardian signs.',
        systemIds: ['sys-jrt-astm-record'],
      }),
      n('complete', 'decision', 'All mandatory steps and paperwork complete?', {
        phase: 'Final signature & release',
        critical: true,
        what: 'Confirm the required documentation is complete.',
        considerations: 'Release only after every mandatory procedure is satisfied.',
        systemIds: ['sys-jrt-astm-record'],
      }),
      n('release', 'end', 'Equipment released to the family', { phase: 'Final signature & release' }),
    ],
    edges: [
      e('start', 'appt'),
      e('appt', 'checkin-appt', 'yes', 'Yes'),
      e('appt', 'checkin-walk', 'no', 'No'),
      e('checkin-appt', 'shoes'),
      e('checkin-walk', 'shoes'),
      e('shoes', 'split'),
      e('split', 'form', 'branch'),
      e('split', 'boot-size', 'branch'),
      e('boot-size', 'boot-stock'),
      e('boot-stock', 'goldilocks', 'yes', 'In stock'),
      e('boot-stock', 'boot-out', 'no', 'Out of stock'),
      e('boot-out', 'goldilocks', 'normal', 'Buying new'),
      e('goldilocks', 'fit-ok'),
      e('fit-ok', 'boot-size', 'loop', 'Try another size'),
      e('fit-ok', 'ski-size', 'yes', 'Just right'),
      e('ski-size', 'ski-stock'),
      e('ski-stock', 'tradein', 'yes', 'In stock'),
      e('ski-stock', 'ski-out', 'no', 'Out of stock'),
      e('ski-out', 'tradein', 'normal', 'Buying new'),
      e('tradein', 'join', 'branch'),
      e('form', 'join', 'branch'),
      e('join', 'retrieve'),
      e('retrieve', 'authorize'),
      e('authorize', 'who-astm'),
      e('who-astm', 'astm-warn', 'branch', 'Run it now'),
      e('who-astm', 'next-child', 'branch', 'Next child'),
      e('next-child', 'astm-warn', 'normal', 'ASTM still required'),
      e('astm-warn', 'astm'),
      e('astm', 'signature'),
      e('signature', 'complete'),
      e('complete', 'release', 'yes', 'Yes'),
      e('complete', 'astm', 'loop', 'No — resolve first'),
    ],
  },
  {
    ...field,
    type: 'workflow',
    id: 'wf-jrt-out-of-stock',
    code: 'JRT-05',
    title: 'Out of stock: options for the family',
    summary: 'Shared by boot fitting and ski sizing when the size isn’t available. Three options — buying new is generally preferred when practical.',
    trigger: 'The needed boot size or ski length isn’t in stock.',
    outcome: 'The family has chosen a path: wait for restock, another location, or new equipment.',
    source: 'Employee field notes, Nov 2026',
    departmentIds: ['dept-jr-trades'],
    systemIds: ['sys-inventory'],
    equipmentIds: ['eq-ski-boots', 'eq-skis'],
    nodes: [
      n('start', 'start', 'Needed size isn’t in stock'),
      n('explain', 'step', 'Explain the three options', {
        what: 'Let the family know the size isn’t available right now and walk them through the options.',
      }),
      n('choose', 'decision', 'Which option works for the family?'),
      n('callback', 'step', 'A · Call back to check for restock', {
        what: 'The family calls back periodically to check whether the size is back in stock.',
        considerations: 'Restock timing isn’t known.',
      }),
      n('other', 'step', 'B · Contact other Front Range locations', {
        what: 'Contact other Front Range locations to see whether they have the size.',
        considerations: 'Which locations to contact, and how, hasn’t been captured.',
      }),
      n('buy', 'step', 'C · Purchase new equipment', {
        what: 'Offer new boots or skis instead.',
        why: 'Buying new is generally the preferred option when practical, and new equipment keeps strong trade-in value.',
        callouts: [{ kind: 'tip', text: 'Generally the preferred option when practical.' }],
      }),
      n('end-wait', 'end', 'Family follows up later'),
      n('end-other', 'end', 'Family uses the location with stock'),
      n('end-buy', 'end', 'Continue fitting with new equipment'),
    ],
    edges: [
      e('start', 'explain'),
      e('explain', 'choose'),
      e('choose', 'callback', 'branch', 'A'),
      e('choose', 'other', 'branch', 'B'),
      e('choose', 'buy', 'branch', 'C · preferred'),
      e('callback', 'end-wait'),
      e('other', 'end-other'),
      e('buy', 'end-buy'),
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Departments                                                        */
/* ------------------------------------------------------------------ */
const sec = (id: string, title: string, workflowIds: string[] = [], description?: string) => ({ id, title, workflowIds, description })

const departments: Department[] = [
  {
    ...field,
    updatedAt: T2,
    createdAt: T,
    id: 'dept-jr-trades',
    type: 'department',
    code: 'JRT',
    accent: 'brass',
    order: 1,
    title: 'JR Trades',
    tagline: 'Junior Trade: kids’ fitting, trade-ins & ASTM',
    summary: 'Getting a child fitted for a Junior Trade package — boots, skis, paperwork, ASTM and release.',
    description:
      'JR = Junior. This department runs the Junior Trade program (from employee field notes). The servicing, repair and inspection sections are the original starter structure — whether they belong here is still an open question.',
    sections: [
      sec('junior-trade', 'Junior Trade fitting', ['wf-jrt-fitting', 'wf-jrt-out-of-stock'], 'From employee field notes. Prices are estimates; ASTM follows approved procedures only.'),
      sec('servicing', 'Equipment servicing', ['wf-jrt-tune']),
      sec('repair', 'Repair workflows', ['wf-jrt-repair']),
      sec('inspection', 'Inspection processes', ['wf-jrt-inspect']),
      sec('handling', 'Equipment handling', [], 'How equipment moves to, through and out of the shop.'),
    ],
    responsibilities: [
      'Junior Trade check-in and fittings',
      'Boot fitting and ski sizing for kids',
      'Explaining out-of-stock options and trade-in value',
      'ASTM authorization, documentation and the parent’s final signature',
      'Equipment servicing, repairs and inspection (starter structure — scope unconfirmed)',
    ],
    systemIds: ['sys-jrt-checkin', 'sys-jrt-parent-form', 'sys-jrt-astm-record', 'sys-inventory'],
    equipmentIds: ['eq-ski-boots', 'eq-skis', 'eq-ski-bindings', 'eq-ipad', 'eq-tuning-tools', 'eq-wax', 'eq-base-repair'],
  },
  {
    ...base,
    id: 'dept-ski',
    type: 'department',
    code: 'SKI',
    accent: 'glacier',
    order: 2,
    title: 'Ski Rentals',
    tagline: 'Intake to return, for skiers',
    summary: 'Getting a skier from the counter onto correctly fitted equipment — and back.',
    description: 'Starter structure for ski rentals. Workflows are illustrative until confirmed.',
    sections: [
      sec('intake', 'Customer intake', ['wf-ski-intake']),
      sec('reservations', 'Reservations & walk-ins', ['wf-ski-intake']),
      sec('customer-info', 'Customer information', []),
      sec('selection', 'Equipment selection', ['wf-ski-select']),
      sec('boot-fitting', 'Boot fitting', ['wf-ski-boot-fit']),
      sec('ski-selection', 'Ski selection', ['wf-ski-select']),
      sec('bindings', 'Binding-related workflows', ['wf-ski-select'], 'Safety-critical. Capture only from authorized training.'),
      sec('issuance', 'Equipment issuance', ['wf-ski-issue']),
      sec('returns', 'Returns', ['wf-ski-return']),
      sec('maintenance', 'Equipment maintenance', ['wf-jrt-tune']),
    ],
    responsibilities: ['Customer intake', 'Boot fitting', 'Ski selection', 'Issuance and returns'],
    equipmentIds: ['eq-skis', 'eq-ski-boots', 'eq-ski-bindings', 'eq-poles', 'eq-helmets', 'eq-foot-measure'],
  },
  {
    ...base,
    id: 'dept-snowboard',
    type: 'department',
    code: 'SNB',
    accent: 'forest',
    order: 3,
    title: 'Snowboard Rentals',
    tagline: 'Intake to return, for riders',
    summary: 'Boots, board, stance and setup for snowboard customers.',
    description: 'Starter structure for snowboard rentals. Workflows are illustrative until confirmed.',
    sections: [
      sec('intake', 'Customer intake', ['wf-snb-intake']),
      sec('reservations', 'Reservations & walk-ins', ['wf-snb-intake']),
      sec('selection', 'Equipment selection', ['wf-snb-setup']),
      sec('boot-fitting', 'Boot fitting', ['wf-snb-setup']),
      sec('board-selection', 'Board selection', ['wf-snb-setup']),
      sec('issuance', 'Equipment issuance', ['wf-snb-return']),
      sec('returns', 'Returns', ['wf-snb-return']),
      sec('maintenance', 'Equipment maintenance', ['wf-jrt-tune']),
    ],
    responsibilities: ['Customer intake', 'Boot fitting', 'Board selection & stance setup', 'Issuance and returns'],
    equipmentIds: ['eq-snowboards', 'eq-snb-boots', 'eq-snb-bindings', 'eq-helmets', 'eq-foot-measure'],
  },
]

/* ------------------------------------------------------------------ */
/* Glossary — general industry terms; local usage unconfirmed         */
/* ------------------------------------------------------------------ */
const g = (
  id: string,
  title: string,
  kind: GlossaryEntry['kind'],
  definition: string,
  extra: Partial<GlossaryEntry> = {},
): GlossaryEntry => ({
  ...base,
  id,
  type: 'glossary',
  title,
  kind,
  definition,
  aka: [],
  departmentIds: [],
  systemIds: [],
  workflowIds: [],
  ...extra,
})

const glossary: GlossaryEntry[] = [
  {
    ...g('gl-jr', 'JR', 'department', 'Junior. In “JR Trades” it refers to the Junior Trade program for kids’ equipment.', {
      aka: ['Junior'],
      departmentIds: ['dept-jr-trades'],
      workflowIds: ['wf-jrt-fitting'],
    }),
    ...field,
    createdAt: T,
  },
  {
    ...g(
      'gl-junior-trade',
      'Junior Trade',
      'process',
      'The kids’ equipment program: a child is fitted for a junior ski package, and the family can later trade it in for credit toward larger equipment as the child grows. Confirm current eligibility, pricing and terms in store.',
      {
        aka: ['Junior Trade program', 'Trade-in'],
        departmentIds: ['dept-jr-trades'],
        systemIds: ['sys-jrt-checkin'],
        workflowIds: ['wf-jrt-fitting', 'wf-jrt-out-of-stock'],
        sourceIds: ['src-jrt-field-notes', 'src-jrt-website'],
      },
    ),
    ...field,
    sourceIds: ['src-jrt-field-notes', 'src-jrt-website'],
  },
  {
    ...g(
      'gl-goldilocks',
      'Goldilocks fit',
      'process',
      'Employee shorthand for a boot fit that is “just right” — not too big, not too small — including where the big toe sits relative to the front of the boot. No exact clearance measurement has been captured; follow approved fitting training.',
      { aka: ['Goldilocks fitting'], departmentIds: ['dept-jr-trades'], workflowIds: ['wf-jrt-fitting'] },
    ),
    ...field,
  },
  {
    ...g(
      'gl-astm',
      'ASTM',
      'acronym',
      'ASTM International, a standards organization. In ski shops “ASTM” is common shorthand for the standardized binding test and its documentation, completed before skis are released. The local procedure, equipment, forms and who may authorize it have not been captured. Safety-critical.',
      {
        aka: ['ASTM test', 'ASTM authorization', 'ASTM signature'],
        departmentIds: ['dept-jr-trades', 'dept-ski'],
        systemIds: ['sys-jrt-astm-record', 'sys-binding-reference'],
        workflowIds: ['wf-jrt-fitting'],
      },
    ),
    // General industry meaning — not from the field notes, so it stays Unverified.
    illustrative: false,
    sourceIds: [],
    createdAt: T2,
    updatedAt: T2,
  },
  {
    ...g(
      'gl-front-range',
      'Front Range locations',
      'general',
      'Other stores in Colorado’s Front Range that may have a size in stock when this one doesn’t. Which locations, and how to check their stock, haven’t been captured.',
      { aka: ['Front Range'], departmentIds: ['dept-jr-trades'], workflowIds: ['wf-jrt-out-of-stock'] },
    ),
    ...field,
  },
  {
    ...g(
      'gl-appointment',
      'Appointment',
      'process',
      'A Junior Trade fitting booked ahead by the parent. Appointment details sometimes include the child’s height and weight.',
      { departmentIds: ['dept-jr-trades'], systemIds: ['sys-jrt-checkin'], workflowIds: ['wf-jrt-fitting'] },
    ),
    ...field,
  },
  g('gl-bsl', 'BSL', 'acronym', 'Boot sole length — the length of a ski boot’s sole in millimetres, usually printed on the shell. Used when bindings are set up for a boot.', {
    aka: ['Boot sole length'],
    departmentIds: ['dept-ski', 'dept-jr-trades'],
    workflowIds: ['wf-ski-boot-fit', 'wf-ski-select'],
  }),
  g('gl-din', 'DIN', 'acronym', 'Common industry shorthand for a ski binding’s release setting (named after a German standards body). Determined only from an authorized reference — never estimated.', {
    aka: ['Release setting', 'DIN setting'],
    departmentIds: ['dept-ski', 'dept-jr-trades'],
    systemIds: ['sys-binding-reference'],
    workflowIds: ['wf-ski-select'],
  }),
  g('gl-mondo', 'Mondopoint', 'equipment', 'Boot sizing system based on foot length in centimetres.', {
    aka: ['Mondo'],
    departmentIds: ['dept-ski', 'dept-snowboard'],
    workflowIds: ['wf-ski-boot-fit'],
  }),
  g('gl-walkin', 'Walk-in', 'process', 'A customer who arrives without a reservation.', {
    departmentIds: ['dept-ski', 'dept-snowboard'],
    workflowIds: ['wf-ski-intake', 'wf-snb-intake'],
  }),
  g('gl-reservation', 'Reservation', 'process', 'A rental booked in advance. How reservations are looked up locally is unconfirmed.', {
    departmentIds: ['dept-ski', 'dept-snowboard'],
    systemIds: ['sys-reservations'],
    workflowIds: ['wf-ski-intake', 'wf-snb-intake'],
  }),
  g('gl-regular', 'Regular', 'equipment', 'Snowboard stance with the left foot forward.', {
    aka: ['Regular stance'],
    departmentIds: ['dept-snowboard'],
    workflowIds: ['wf-snb-setup'],
  }),
  g('gl-goofy', 'Goofy', 'equipment', 'Snowboard stance with the right foot forward.', {
    aka: ['Goofy stance'],
    departmentIds: ['dept-snowboard'],
    workflowIds: ['wf-snb-setup'],
  }),
  g('gl-stance-width', 'Stance width', 'equipment', 'Distance between the centres of a snowboard’s two bindings.', {
    departmentIds: ['dept-snowboard'],
    workflowIds: ['wf-snb-setup'],
  }),
  g('gl-camber', 'Camber', 'equipment', 'Upward arch in the middle of a ski or board when laid flat.', { departmentIds: ['dept-ski', 'dept-snowboard'] }),
  g('gl-rocker', 'Rocker', 'equipment', 'Upturned profile at the tip and/or tail of a ski or board.', { departmentIds: ['dept-ski', 'dept-snowboard'] }),
  g('gl-edge-tune', 'Edge tune', 'process', 'Sharpening and bevelling the metal edges of a ski or board.', {
    departmentIds: ['dept-jr-trades'],
    workflowIds: ['wf-jrt-tune'],
  }),
  g('gl-base-grind', 'Base grind', 'process', 'Machine flattening and texturing of a ski or board base.', { departmentIds: ['dept-jr-trades'] }),
  g('gl-ptex', 'P-tex', 'equipment', 'Polyethylene material used for ski and board bases and for filling base gouges.', {
    departmentIds: ['dept-jr-trades'],
    workflowIds: ['wf-jrt-repair'],
  }),
  g('gl-checkin', 'Check-in', 'process', 'Recording that rented equipment has been returned.', {
    departmentIds: ['dept-ski', 'dept-snowboard'],
    systemIds: ['sys-rental-record'],
    workflowIds: ['wf-ski-return', 'wf-snb-return'],
  }),
  g('gl-fleet', 'Fleet', 'general', 'The full set of rental equipment.', { departmentIds: ['dept-ski', 'dept-snowboard', 'dept-jr-trades'] }),
]

/* ------------------------------------------------------------------ */
/* Open questions                                                     */
/* ------------------------------------------------------------------ */
const q = (id: string, title: string, body: string, links: Note['links']): Note => ({
  ...base,
  illustrative: false,
  id,
  type: 'note',
  kind: 'question',
  title,
  body,
  links,
  resolved: false,
})

const notes: Note[] = [
  {
    ...q('q-jr-meaning', 'What does “JR” in JR Trades refer to?', 'Confirm the department’s name and scope.', [{ type: 'department', id: 'dept-jr-trades' }]),
    status: 'observed',
    updatedAt: T2,
    sourceIds: ['src-jrt-field-notes'],
    resolved: true,
    answer: 'Junior — the Junior Trade program for kids’ equipment (employee field notes; public Junior Trade page). Whether the shop servicing sections also belong to this department is a separate open question.',
  },
  q('q-res-system', 'Which system is used to look up reservations?', 'Capture the product name, search fields and a screenshot of the lookup screen.', [
    { type: 'system', id: 'sys-reservations' },
  ]),
  q('q-agreement', 'Is a rental agreement or waiver completed at intake?', 'If so: when, in what form, and is it ever done online beforehand?', [
    { type: 'workflow', id: 'wf-ski-intake', nodeId: 'agreement' },
  ]),
  q('q-binding-auth', 'Who is authorized to do binding work, and what sign-off is required?', 'Capture only from authorized training.', [
    { type: 'workflow', id: 'wf-ski-select', nodeId: 'check' },
  ]),
  q('q-repair-tag', 'How is an item flagged for repair?', 'Physical tag, form, or a record in a system? What information goes on it?', [{ type: 'system', id: 'sys-repair-tag' }]),
  /* Junior Trade field notes — what still needs confirming */
  { ...q('q-jrt-scope', 'Does JR Trades also handle servicing, repair and inspection?', 'The shop sections are original starter structure. Confirm whether they belong to this department or another one.', [{ type: 'department', id: 'dept-jr-trades' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-checkin', 'Which system is used to check in Junior Trade guests?', 'Capture the product name, how appointments are found, and where the child’s height and weight appear.', [{ type: 'system', id: 'sys-jrt-checkin' }, { type: 'workflow', id: 'wf-jrt-fitting', nodeId: 'checkin-appt' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-walkin', 'How are guests without an appointment checked in?', 'Capture the steps and screens for a walk-in Junior Trade fitting.', [{ type: 'workflow', id: 'wf-jrt-fitting', nodeId: 'checkin-walk' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-form', 'Which app and form are used on the iPad?', 'Capture the app name, the form’s fields and where the selected equipment is entered.', [{ type: 'system', id: 'sys-jrt-parent-form' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-pricing', 'Confirm current Junior Trade pricing', 'Employee-reported: base package ≈ $175, new boots ≈ +$45, new skis ≈ +$100. Confirm against current official pricing.', [{ type: 'workflow', id: 'wf-jrt-fitting', nodeId: 'boot-out' }, { type: 'workflow', id: 'wf-jrt-fitting', nodeId: 'ski-out' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-tradein', 'Confirm trade-in eligibility and terms', 'The public page describes 50% of the original purchase price toward larger equipment. Confirm eligibility, conditions and current terms before quoting them as policy.', [{ type: 'workflow', id: 'wf-jrt-fitting', nodeId: 'tradein' }, { type: 'source', id: 'src-jrt-website' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-astm', 'Capture the approved ASTM procedure', 'From authorized training only: who may authorize and perform ASTM, the required documentation, and the approved procedure to link here.', [{ type: 'workflow', id: 'wf-jrt-fitting', nodeId: 'astm' }, { type: 'system', id: 'sys-jrt-astm-record' }]), createdAt: T2, updatedAt: T2 },
  { ...q('q-jrt-locations', 'How do staff check stock at other Front Range locations?', 'Which locations, and is it a phone call or a system lookup?', [{ type: 'workflow', id: 'wf-jrt-out-of-stock', nodeId: 'other' }]), createdAt: T2, updatedAt: T2 },
]

/**
 * Content versions. A fresh database receives every entity above. An
 * existing database is brought up to date by applying each version's list:
 * new items are added, and changed starter items are replaced ONLY if nobody
 * has edited them yet (no revision) and they were not deleted — so a
 * person's own edits and deletions always win.
 */
export const SEED_VERSION = 2

export const SEED_UPDATES: Record<number, { note: string; ids: string[] }> = {
  2: {
    note: 'Junior Trade employee field notes',
    ids: [
      'src-jrt-field-notes',
      'src-jrt-website',
      'sys-jrt-checkin',
      'sys-jrt-parent-form',
      'sys-jrt-astm-record',
      'eq-ipad',
      'wf-jrt-fitting',
      'wf-jrt-out-of-stock',
      'dept-jr-trades',
      'gl-jr',
      'gl-junior-trade',
      'gl-goldilocks',
      'gl-astm',
      'gl-front-range',
      'gl-appointment',
      'q-jr-meaning',
      'q-jrt-scope',
      'q-jrt-checkin',
      'q-jrt-walkin',
      'q-jrt-form',
      'q-jrt-pricing',
      'q-jrt-tradein',
      'q-jrt-astm',
      'q-jrt-locations',
    ],
  },
}

export const seedEntities: Entity[] = [...sources, ...systems, ...equipment, ...workflows, ...departments, ...glossary, ...notes]
