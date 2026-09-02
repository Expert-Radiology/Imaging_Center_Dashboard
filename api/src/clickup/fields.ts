/**
 * ClickUp field ids for list 901316440634 ("Imaging Center Onboarding"),
 * workspace 90131678983, space 90137281639.
 *
 * Two traps documented in the handoff and enforced below:
 *
 *  1. `Date Start` and `Ping Passed?` are AI-populated *text* fields, not
 *     structured data. `Date Start` returns "05-12-2026" but also "N/A" and
 *     "No client response found." Everything reading them parses defensively
 *     and yields null rather than NaN or Invalid Date.
 *
 *  2. Two pairs of duplicate fields share a name with different types — the
 *     radiologist-credentialing question and the patient-history question each
 *     exist as both a checkbox and a dropdown. The dropdowns are live; the
 *     checkboxes are dead. Only the dropdown ids appear here. Worth raising
 *     with Cristian for cleanup.
 */
export const FIELD = {
  dateStart: 'd4f2d85b-41f4-4dbb-8668-160ca93fb9d9',
  pendingContact: '8600907e-f9ca-4ba6-a23a-7fd4b62da27e',
  pingPassed: 'cda3d12a-5809-43df-990e-23c6ace4bca9',
  progress: '9653591d-190a-43b9-9da3-a7ce32c9337f',
  pacsVendor: '2865b3ca-554a-4745-b983-8f15d18e47e7',
  states: '55541b3b-b10a-4fb4-8333-eb6cb3d62196',
  numberOfLocations: '7041b311-fd60-4c1f-8cff-330be1fb411b',
  typeOfConnection: '5c6b92db-d74e-4ea1-99f7-8206a2b2f431',
  hl7: '73e0dc09-cb99-4ed3-8113-9a11346a5170',
  vpnDestination: '54a30778-29ce-48d7-9711-2556fd407d25',
  ramsoftVpnTicketId: '484e2ad7-53fa-4bbd-a1ff-a651ac4c6ef3',
  signedPsa: 'cbffa08e-05fd-4352-9120-c7b01dd68572',
  /**
   * Marked required on the list but empty on every center. Not displayed until
   * it is actually populated — a required-but-empty field is a data gap, and
   * the dashboard shows gaps rather than zeros.
   */
  mriPerMonth: '95bf0d9b-5248-4147-8394-34aaaaa401d6',
} as const;

/**
 * The four fields the dashboard needs that do not exist on the list yet.
 *
 * Resolved by *name* at refresh time rather than by id, because the ids will
 * only exist once someone creates them. The moment they appear on the list the
 * refresh starts reading them and the "no ClickUp source" callout stops
 * rendering — no code change needed.
 *
 * Expected shapes (see the handoff's Critical Data-Model Prerequisite):
 *   HL7 VPN status  — dropdown: Not started / Requested / Tunnel up / Validated / n/a
 *   HL7 testing     — dropdown: Not started / In progress / Passed / n/a
 *   Facility built  — checkbox (or dropdown)
 *   Station built   — checkbox (or dropdown)
 *   Est. deployment — date
 */
export const PENDING_FIELD_NAMES = {
  hl7VpnStatus: ['hl7 vpn status', 'hl7 vpn'],
  hl7TestingStatus: ['hl7 testing done', 'hl7 testing', 'hl7 test'],
  facilityBuilt: ['facility built', 'facility'],
  stationBuilt: ['station built', 'ramsoft station built'],
  estimatedDeployment: ['estimated deployment date', 'est. deployment date', 'go-live date'],
} as const;

/** The five `Pending Contact?` dropdown options, mapped 1:1 to blocker groups. */
export const PENDING_CONTACT_TO_GROUP: Record<string, string> = {
  customer: 'customer',
  'waiting on customer': 'customer',
  ramsoft: 'ramsoft',
  'waiting on ramsoft': 'ramsoft',
  internal: 'internal',
  'internal team': 'internal',
  'waiting on internal team': 'internal',
  "client's pacs": 'clientPacs',
  'client pacs': 'clientPacs',
  "waiting on client's pacs": 'clientPacs',
  technosoft: 'technosoft',
  'waiting on technosoft': 'technosoft',
};

/**
 * Milestone columns are read from subtask completion. Subtask naming is not
 * perfectly consistent on the list, so each milestone matches on keywords.
 *
 * VERIFY THESE against the real subtask names before launch — a keyword that
 * never matches silently renders an open circle forever, which looks like real
 * "not done" data. `refresh` logs any center whose subtasks matched nothing.
 */
export const MILESTONE_MATCHERS = {
  vpnForm: [/vpn form/i, /vpn request/i, /vpn questionnaire/i],
  ping: [/ping/i, /tunnel up/i],
  testStudy: [/test study/i, /test image/i, /test dicom/i],
  headerTemplate: [/header/i, /dotx/i, /report template/i],
  ramsoftStation: [/station/i, /ae title/i],
} as const;

export const FACILITY_MATCHERS = [/facility/i];
export const STATION_MATCHERS = [/station/i];
export const DICOM_STUDY_MATCHERS = [/test study/i, /dicom study/i, /test image/i];
export const HL7_TEST_MATCHERS = [/hl7 test/i, /oru/i, /adt/i];
export const DICOM_VPN_MATCHERS = [/vpn/i];
export const HEADER_DOTX_MATCHERS = [/header/i, /dotx/i];
