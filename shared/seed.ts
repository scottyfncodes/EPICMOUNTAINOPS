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

const base = { status: 'unverified' as const, illustrative: true, createdAt: T, updatedAt: T, sourceIds: ['src-starter'] }

function n(id: string, kind: NodeKind, label: string, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, kind, label, ...extra }
}
function e(source: string, target: string, kind: EdgeKind = 'normal', label?: string): FlowEdge {
  return { id: `${source}->${target}`, source, target, kind, ...(label ? { label } : {}) }
}

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
]

/* ------------------------------------------------------------------ */
/* Departments                                                        */
/* ------------------------------------------------------------------ */
const sec = (id: string, title: string, workflowIds: string[] = [], description?: string) => ({ id, title, workflowIds, description })

const departments: Department[] = [
  {
    ...base,
    id: 'dept-jr-trades',
    type: 'department',
    code: 'JRT',
    accent: 'brass',
    order: 1,
    title: 'JR Trades',
    tagline: 'Servicing, repair & inspection',
    summary: 'The shop side: keeping rental equipment safe and in rotation.',
    description:
      'Starter structure based on the categories you listed. The department’s exact scope — and what “JR” refers to — still needs to be confirmed.',
    sections: [
      sec('servicing', 'Equipment servicing', ['wf-jrt-tune']),
      sec('repair', 'Repair workflows', ['wf-jrt-repair']),
      sec('inspection', 'Inspection processes', ['wf-jrt-inspect']),
      sec('handling', 'Equipment handling', [], 'How equipment moves to, through and out of the shop.'),
    ],
    responsibilities: ['Equipment servicing (unconfirmed scope)', 'Repairs routed from rentals', 'Inspection before return to fleet'],
    equipmentIds: ['eq-tuning-tools', 'eq-wax', 'eq-base-repair'],
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
  g('gl-jr', 'JR', 'department', 'Meaning in “JR Trades” not yet confirmed.', {
    departmentIds: ['dept-jr-trades'],
    notes: 'Open question — see Review.',
  }),
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
  q('q-jr-meaning', 'What does “JR” in JR Trades refer to?', 'Confirm the department’s name and scope.', [{ type: 'department', id: 'dept-jr-trades' }]),
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
]

export const SEED_VERSION = 1

export const seedEntities: Entity[] = [...sources, ...systems, ...equipment, ...workflows, ...departments, ...glossary, ...notes]
