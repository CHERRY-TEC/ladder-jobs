/**
 * Ladder taxonomies — the 10-rung education ladder and 6 experience rungs
 * from the master prompt. IDs match the DB check constraints in
 * supabase/migrations/0001_ladder_schema.sql exactly.
 *
 * Note: job listings currently filter on the short 4-rung set in seed.js
 * (none/diploma/graduate/any); migration to the full ladder on the job side
 * happens in Phase 6. Profile education always uses the full ladder.
 */

export const EDUCATION_LADDER = [
  { id: 'no_formal', label: 'No formal education', note: 'Self-taught or never schooled' },
  { id: 'below_10th', label: 'Below 10th', note: 'Some schooling, no 10th pass' },
  { id: '10th', label: '10th pass (SSC)', note: 'Secondary school certificate' },
  { id: 'intermediate', label: 'Intermediate (12th)', note: 'Intermediate / HSC / 12th' },
  { id: 'iti', label: 'ITI', note: 'Industrial Training Institute certificate' },
  { id: 'diploma', label: 'Diploma', note: 'Polytechnic / diploma holder' },
  { id: 'undergraduate', label: 'Undergraduate', note: "Bachelor's in progress or equivalent" },
  { id: 'graduate', label: 'Graduate', note: "Bachelor's degree (B.A / B.Tech / B.Com …)" },
  { id: 'postgraduate', label: 'Postgraduate', note: "Master's degree or above (M.A / M.Tech / MBA)" },
  // Job-side rung: a listing open to every level. Never a profile answer.
  { id: 'any', label: 'Any education', note: 'Open to every level', jobsOnly: true },
]

/** Profile-side selectable rungs (everything except the jobs-only 'any'). */
export const PROFILE_EDUCATION = EDUCATION_LADDER.filter((e) => !e.jobsOnly)

export const EDU_LABELS = Object.fromEntries(EDUCATION_LADDER.map((e) => [e.id, e.label]))

export const EXPERIENCE_LEVELS = [
  { id: 'fresher', label: 'Fresher', note: 'Just out of study, first job' },
  { id: 'no_experience', label: 'No experience', note: 'Looking for the first role' },
  { id: '0-1', label: '0–1 year', note: 'Under a year of work' },
  { id: '1-3', label: '1–3 years', note: 'Some professional experience' },
  { id: '3-5', label: '3–5 years', note: 'Solid mid-level experience' },
  { id: '5+', label: '5+ years', note: 'Senior experience' },
]

export const EXP_LABELS = Object.fromEntries(EXPERIENCE_LEVELS.map((e) => [e.id, e.label]))

export const SKILL_LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]

/** Resume upload rules — enforced client-side here and server-side in the DB. */
export const RESUME_RULES = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  extensions: ['.pdf', '.doc', '.docx'],
  label: 'PDF, DOC or DOCX · up to 5 MB',
}

/* ------------------------------------------------------------------ employer */

/** Company size options — Indian hiring context. */
export const COMPANY_SIZES = [
  { id: '1-10', label: '1–10 people' },
  { id: '11-50', label: '11–50 people' },
  { id: '51-200', label: '51–200 people' },
  { id: '201-500', label: '201–500 people' },
  { id: '501-1000', label: '501–1,000 people' },
  { id: '1000+', label: '1,000+ people' },
]

/** Industries shown on the company profile. Free text is not offered — a fixed
 *  list keeps filters honest later on. */
export const INDUSTRIES = [
  'Logistics & Warehousing',
  'Manufacturing',
  'Retail & E-commerce',
  'Construction',
  'Hospitality',
  'Healthcare',
  'Information Technology',
  'Education',
  'Agriculture',
  'Banking & Finance',
  'Transport & Delivery',
  'Facilities & Housekeeping',
  'Other',
]

/** Verification document types — IDs match the check constraint on
 *  ladder_employer_verifications.document_type in 0001_ladder_schema.sql. */
export const VERIFICATION_DOCUMENT_TYPES = [
  { id: 'gst', label: 'GST certificate', hint: 'GSTIN on the certificate must match your company name' },
  { id: 'cin', label: 'CIN (company registration)', hint: 'For private limited / LLP companies' },
  { id: 'udyam', label: 'Udyam / MSME registration', hint: 'Good for small and local businesses' },
  { id: 'business_license', label: 'Business license', hint: 'Municipal or trade license' },
  { id: 'id_proof', label: 'Owner ID proof', hint: 'Aadhaar / PAN of the authorised signatory' },
  { id: 'other', label: 'Other document', hint: 'Anything else that proves the business exists' },
]

/** Verification upload rules. The bucket (`ladder-verification`, 0003) enforces
 *  the 10 MB ceiling server-side; the list below matches it exactly. */
export const VERIFICATION_RULES = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
  extensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  label: 'PDF, PNG, JPG or WEBP · up to 10 MB',
}

/** Company logo rules — matches the `ladder-logos` bucket (2 MB, image only). */
export const LOGO_RULES = {
  maxBytes: 2 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  extensions: ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
  label: 'PNG, JPG, WEBP or SVG · up to 2 MB',
}

/** Employer status → the only wording allowed to describe it. The badge itself
 *  renders solely for `verified`, which only an admin approval can produce. */
export const EMPLOYER_STATUS = {
  unverified: {
    label: 'Not verified',
    tone: 'muted',
    explain: 'No documents submitted yet. Add your company details, then submit a registration document for review.',
  },
  pending: {
    label: 'Verification in review',
    tone: 'pending',
    explain: 'Your documents are with the admin team. This is not a verified badge — it disappears the moment a decision is made.',
  },
  verified: {
    label: 'Verified',
    tone: 'verified',
    explain: 'An admin checked your registration document and approved it. The date below is when that happened.',
  },
  rejected: {
    label: 'Verification rejected',
    tone: 'rejected',
    explain: 'The last document was not accepted. Read the reason, fix it and submit again.',
  },
  suspended: {
    label: 'Account suspended',
    tone: 'rejected',
    explain: 'An admin suspended this company. Contact support — employers cannot lift this themselves.',
  },
}

/* --------------------------------------------------------------------- jobs */

/**
 * The four coarse rungs of the hero stair. Each maps onto the full 10-rung
 * ladder, so a job posted with any `education_required` still lands under the
 * right stair. IDs are the legacy four (`none`, `diploma`, `graduate`, `any`)
 * because the stair URL param and the original demo data use them — the rungs
 * array is what makes them speak the 10-rung vocabulary.
 */
export const EDU_PRESETS = [
  {
    id: 'none',
    label: 'No degree needed',
    stair: 'No degree',
    note: 'Schooling only — no college degree required',
    rungs: ['no_formal', 'below_10th', '10th', 'intermediate', 'none'],
  },
  {
    id: 'diploma',
    label: 'Diploma / ITI',
    stair: 'Diploma',
    note: 'Diploma, ITI or certificate holders',
    rungs: ['iti', 'diploma'],
  },
  {
    id: 'graduate',
    label: "Bachelor's degree or equivalent",
    stair: 'Graduate',
    note: "Bachelor's degree or equivalent",
    rungs: ['undergraduate', 'graduate', 'postgraduate'],
  },
  {
    id: 'any',
    label: 'Any education',
    stair: 'Any',
    note: 'Open to every education level',
    rungs: ['any'],
  },
]

/** Legacy 4-rung ids that only exist in the offline demo data (seed.js). */
const LEGACY_EDU_LABELS = {
  none: 'No degree needed',
  diploma: 'Diploma / ITI',
  graduate: 'Graduate',
  any: 'Any education',
}

/** Display label for ANY education id — 10-rung first, legacy demo second. */
export function eduLabel(id) {
  if (!id) return null
  return EDU_LABELS[id] ?? LEGACY_EDU_LABELS[id] ?? null
}

/** Minimum monthly-equivalent pay for the salary filter (IDs go in the URL).
 *  `ladder_jobs.salary_min` is stored monthly even for daily-wage rows
 *  (₹600/day → 15,600), so one threshold list stays honest across periods. */
export const PAY_THRESHOLDS = [
  { id: '10000', label: '₹10,000+ / month', min: 10000 },
  { id: '15000', label: '₹15,000+ / month', min: 15000 },
  { id: '25000', label: '₹25,000+ / month', min: 25000 },
  { id: '50000', label: '₹50,000+ / month', min: 50000 },
]

/** Work-mode filter options — IDs match `ladder_jobs.work_mode`. */
export const WORK_MODES = [
  { id: 'onsite', label: 'On-site' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'remote', label: 'Remote' },
]

/** Posted-within filter options — ID is the number of days. */
export const POSTED_WITHIN = [
  { id: '1', label: 'Last 24 hours' },
  { id: '3', label: 'Last 3 days' },
  { id: '7', label: 'Last week' },
  { id: '30', label: 'Last month' },
]

/** Job status wording — transitions are owned by `ladder_jobs_lock_status()`
 *  (DB) and by admin moderation; this map only describes each state honestly. */
export const JOB_STATUS = {
  draft: {
    label: 'Draft',
    tone: 'muted',
    explain: 'Saved but not submitted. Nobody but you can see it.',
  },
  pending: {
    label: 'In review',
    tone: 'pending',
    explain: 'With the admin team for moderation — seekers cannot see it yet.',
  },
  active: {
    label: 'Live',
    tone: 'verified',
    explain: 'Published and visible to every seeker on the board.',
  },
  closed: {
    label: 'Filled / closed',
    tone: 'muted',
    explain: 'Vacancies are filled or hiring is closed — it no longer appears on the public board. Re-submit if you need to hire again.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'rejected',
    explain: 'An admin declined this listing. Edit it and re-submit for another review.',
  },
  expired: {
    label: 'Expired',
    tone: 'muted',
    explain: 'Past its expiry date, so it dropped off the board automatically.',
  },
}

/**
 * Application stage ladder — seeker → employer pipeline. Stage changes are
 * enforced by `ladder_applications_lock_status` (migration 0001): the applicant
 * may only withdraw; the employer owning the job may move the candidate through
 * any stage; trusted (admin/SQL) writers keep full control.
 */
export const APPLICATION_STAGES = [
  { id: 'applied', label: 'Applied', tone: 'pending', hint: 'Sent — waiting for the employer to look.' },
  { id: 'viewed', label: 'Viewed', tone: 'pending', hint: 'The employer opened your application.' },
  { id: 'shortlisted', label: 'Shortlisted', tone: 'pending', hint: 'The employer saved you as a contender.' },
  { id: 'interview', label: 'Interview', tone: 'pending', hint: 'An interview was scheduled.' },
  { id: 'selected', label: 'Selected', tone: 'verified', hint: 'An offer or next step was agreed.' },
  { id: 'rejected', label: 'Rejected', tone: 'rejected', hint: 'The employer decided not to move forward.' },
  { id: 'withdrawn', label: 'Withdrawn', tone: 'muted', hint: 'You pulled the application.' },
]

export const STAGE_LABELS = Object.fromEntries(APPLICATION_STAGES.map((s) => [s.id, s.label]))
export const STAGE_ORDER = Object.fromEntries(APPLICATION_STAGES.map((s, i) => [s.id, i]))
