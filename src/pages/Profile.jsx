import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import SeekerNav from '../components/SeekerNav.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import {
  PROFILE_EDUCATION,
  EDU_LABELS,
  EXPERIENCE_LEVELS,
  EXP_LABELS,
  SKILL_LEVELS,
} from '../data/ladder.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

/* ------------------------------------------------------------------ state -- */

const emptyEdu = { level: 'graduate', institution: '', field_of_study: '', start_year: '', end_year: '', is_current: false }
const emptyExp = { title: '', company: '', start_date: '', end_date: '', is_current: false, description: '' }

export default function Profile() {
  const { user, profile, reloadRole } = useAuth()
  const { notify } = useStore()
  const [backend, setBackend] = useState('checking')

  const [basics, setBasics] = useState(null)
  const [education, setEducation] = useState([])
  const [experience, setExperience] = useState([])
  const [skills, setSkills] = useState([]) // {id?, name, level}
  const [skillDraft, setSkillDraft] = useState({ name: '', level: 'intermediate' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dbReady = backend === 'ready'

  // One shared probe decides whether forms are enabled or honestly disabled.
  useEffect(() => {
    let alive = true
    probeBackend().then((s) => alive && setBackend(s))
    return () => {
      alive = false
    }
  }, [])

  // Seed local form state from the loaded profile row.
  useEffect(() => {
    if (!profile) return
    setBasics({
      full_name: profile.full_name ?? '',
      headline: profile.headline ?? '',
      bio: profile.bio ?? '',
      phone: profile.phone ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      experience_level: profile.experience_level ?? '',
      date_of_birth: profile.date_of_birth ?? '',
    })
  }, [profile])

  // Load dependent rows when the schema is actually there.
  useEffect(() => {
    if (!dbReady || !user) {
      if (!dbReady) setLoading(false)
      return
    }
    let alive = true
    setLoading(true)

    Promise.all([
      supabase
        .from('ladder_candidate_education')
        .select('id, level, institution, field_of_study, start_year, end_year, is_current')
        .eq('profile_id', user.id)
        .order('start_year', { ascending: false, nullsFirst: false }),
      supabase
        .from('ladder_candidate_experience')
        .select('id, title, company, start_date, end_date, is_current, description')
        .eq('profile_id', user.id)
        .order('start_date', { ascending: false }),
      supabase
        .from('ladder_candidate_skills')
        .select('skill_id, level, ladder_skills!inner(name)')
        .eq('profile_id', user.id),
    ]).then(([edu, exp, sk]) => {
      if (!alive) return
      if (edu.error) setError(edu.error.message)
      else
        setEducation(
          edu.data.map((r) => ({
            ...r,
            start_year: r.start_year ?? '',
            end_year: r.end_year ?? '',
          })),
        )
      if (exp.error) setError(exp.error.message)
      else
        setExperience(
          exp.data.map((r) => ({ ...r, start_date: r.start_date ?? '', end_date: r.end_date ?? '' })),
        )
      if (sk.error) setError(sk.error.message)
      else
        setSkills(
          sk.data.map((r) => ({
            skill_id: r.skill_id,
            name: r.ladder_skills?.name ?? '(unknown)',
            level: r.level,
          })),
        )
      setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [dbReady, user])

  /* ------------------------------------------------------------- handlers -- */

  const setField = (key) => (e) => setBasics((b) => ({ ...b, [key]: e.target.value }))

  const saveBasics = async () => {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('ladder_profiles')
      .update({
        full_name: basics.full_name.trim() || null,
        headline: basics.headline.trim() || null,
        bio: basics.bio.trim() || null,
        phone: basics.phone.trim() || null,
        city: basics.city.trim() || null,
        state: basics.state.trim() || null,
        experience_level: basics.experience_level || null,
        date_of_birth: basics.date_of_birth || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (err) setError(err.message)
    else {
      notify('Profile saved')
      reloadRole()
    }
  }

  const addEducation = async () => {
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('ladder_candidate_education')
      .insert({
        profile_id: user.id,
        level: emptyEdu.level,
        institution: null,
        field_of_study: null,
        start_year: null,
        end_year: null,
        is_current: false,
      })
      .select()
      .single()
    setSaving(false)
    if (err) setError(err.message)
    else
      setEducation((list) => [
        { ...emptyEdu, id: data.id, start_year: '', end_year: '' },
        ...list,
      ])
  }

  const patchEducation = (id, key, value) =>
    setEducation((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)))

  const saveEducationRow = async (row) => {
    setError(null)
    const { error: err } = await supabase
      .from('ladder_candidate_education')
      .update({
        level: row.level,
        institution: row.institution?.trim() || null,
        field_of_study: row.field_of_study?.trim() || null,
        start_year: row.start_year === '' ? null : Number(row.start_year),
        end_year: row.end_year === '' ? null : Number(row.end_year),
        is_current: Boolean(row.is_current),
      })
      .eq('id', row.id)
    if (err) setError(err.message)
    else notify('Education saved')
  }

  const removeEducation = async (id) => {
    setError(null)
    const { error: err } = await supabase
      .from('ladder_candidate_education')
      .delete()
      .eq('id', id)
    if (err) setError(err.message)
    else setEducation((list) => list.filter((r) => r.id !== id))
  }

  const addExperience = async () => {
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('ladder_candidate_experience')
      .insert({
        profile_id: user.id,
        title: 'New role',
        start_date: new Date().toISOString().slice(0, 10),
        is_current: true,
      })
      .select()
      .single()
    setSaving(false)
    if (err) setError(err.message)
    else setExperience((list) => [{ ...emptyExp, id: data.id }, ...list])
  }

  const patchExperience = (id, key, value) =>
    setExperience((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)))

  const saveExperienceRow = async (row) => {
    setError(null)
    const { error: err } = await supabase
      .from('ladder_candidate_experience')
      .update({
        title: row.title.trim() || 'Untitled role',
        company: row.company?.trim() || null,
        start_date: row.start_date || new Date().toISOString().slice(0, 10),
        end_date: row.is_current ? null : row.end_date || null,
        is_current: Boolean(row.is_current),
        description: row.description?.trim() || null,
      })
      .eq('id', row.id)
    if (err) setError(err.message)
    else notify('Experience saved')
  }

  const removeExperience = async (id) => {
    setError(null)
    const { error: err } = await supabase
      .from('ladder_candidate_experience')
      .delete()
      .eq('id', id)
    if (err) setError(err.message)
    else setExperience((list) => list.filter((r) => r.id !== id))
  }

  const addSkill = async () => {
    const name = skillDraft.name.trim()
    if (!name) return
    setSaving(true)
    setError(null)

    // Find-or-create the canonical skill row.
    let { data: found } = await supabase
      .from('ladder_skills')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()

    if (!found) {
      const { data: created, error: err } = await supabase
        .from('ladder_skills')
        .insert({ name })
        .select('id')
        .single()
      if (err) {
        setSaving(false)
        // Unique race: someone added it between select and insert.
        if (err.code === '23505') {
          const { data: again } = await supabase
            .from('ladder_skills')
            .select('id')
            .ilike('name', name)
            .limit(1)
            .maybeSingle()
          found = again
        } else {
          setError(err.message)
          return
        }
      } else found = created
    }
    if (!found) {
      setSaving(false)
      setError('Could not resolve that skill — try again.')
      return
    }

    const { error: err } = await supabase
      .from('ladder_candidate_skills')
      .insert({ profile_id: user.id, skill_id: found.id, level: skillDraft.level })
    setSaving(false)
    if (err) {
      if (err.code === '23505') setError('You already listed that skill.')
      else setError(err.message)
    } else {
      setSkills((list) => [...list, { skill_id: found.id, name, level: skillDraft.level }])
      setSkillDraft({ name: '', level: 'intermediate' })
      notify('Skill added')
    }
  }

  const removeSkill = async (skillId) => {
    setError(null)
    const { error: err } = await supabase
      .from('ladder_candidate_skills')
      .delete()
      .eq('profile_id', user.id)
      .eq('skill_id', skillId)
    if (err) setError(err.message)
    else setSkills((list) => list.filter((s) => s.skill_id !== skillId))
  }

  /* ---------------------------------------------------------------- render -- */

  return (
    <DashboardShell title="My Profile" subtitle="What employers see when you apply.">
      <SeekerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="profile-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — profile editing is disabled. Nothing is faked or stored locally.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md) and this form goes live.'
              : 'Backend connection error — profile editing is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------- basics -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="section-basics">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Basics</h2>
          <span className="text-xs text-mute">Rung: experience & education</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputClass} value={basics?.full_name ?? ''} onChange={setField('full_name')} disabled={!dbReady} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={basics?.phone ?? ''} onChange={setField('phone')} placeholder="+91…" disabled={!dbReady} />
          </Field>
          <Field label="Headline" hint="One line — what you do">
            <input className={inputClass} value={basics?.headline ?? ''} onChange={setField('headline')} placeholder="Warehouse associate · Medchal" disabled={!dbReady} />
          </Field>
          <Field label="Experience level" hint="Matches the job-side experience ladder">
            <select className={inputClass} value={basics?.experience_level ?? ''} onChange={setField('experience_level')} disabled={!dbReady}>
              <option value="">Prefer not to say</option>
              {EXPERIENCE_LEVELS.map((e) => (
                <option key={e.id} value={e.id}>{e.label} — {e.note}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input className={inputClass} value={basics?.city ?? ''} onChange={setField('city')} placeholder="Hyderabad" disabled={!dbReady} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={basics?.state ?? ''} onChange={setField('state')} placeholder="Telangana" disabled={!dbReady} />
          </Field>
          <Field label="Date of birth" hint="Used only to check minimum-age rules">
            <input type="date" className={inputClass} value={basics?.date_of_birth ?? ''} onChange={setField('date_of_birth')} disabled={!dbReady} />
          </Field>
        </div>

        <Field label="About you" className="mt-4" hint="A few honest lines employers will actually read">
          <textarea
            rows={3}
            className={inputClass}
            value={basics?.bio ?? ''}
            onChange={setField('bio')}
            disabled={!dbReady}
          />
        </Field>

        <button
          onClick={saveBasics}
          disabled={!dbReady || saving || !basics}
          className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="save-basics"
        >
          {saving ? 'Saving…' : 'Save basics'}
        </button>
      </section>

      {/* ------------------------------------------------------- education -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="section-education">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink">Education</h2>
            <p className="mt-1 text-xs text-mute">The 10-rung ladder — highest rung first is fine.</p>
          </div>
          <button
            onClick={addEducation}
            disabled={!dbReady || saving}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-mute disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="add-education"
          >
            + Add
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : education.length === 0 ? (
          <p className="mt-4 text-sm text-mute">
            {dbReady ? 'No education added yet — employers filter by rung, so add yours.' : '—'}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {education.map((row) => (
              <li key={row.id} className="rounded-lg border border-line p-4" data-testid="education-row">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Level">
                    <select
                      className={inputClass}
                      value={row.level}
                      onChange={(e) => patchEducation(row.id, 'level', e.target.value)}
                    >
                      {PROFILE_EDUCATION.map((e) => (
                        <option key={e.id} value={e.id}>{e.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Institution">
                    <input
                      className={inputClass}
                      value={row.institution ?? ''}
                      onChange={(e) => patchEducation(row.id, 'institution', e.target.value)}
                      placeholder="Sri Chaitanya Jr. College"
                    />
                  </Field>
                  <Field label="Field of study">
                    <input
                      className={inputClass}
                      value={row.field_of_study ?? ''}
                      onChange={(e) => patchEducation(row.id, 'field_of_study', e.target.value)}
                      placeholder="MPC"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From year">
                      <input
                        inputMode="numeric"
                        className={inputClass}
                        value={row.start_year}
                        onChange={(e) => patchEducation(row.id, 'start_year', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        placeholder="2019"
                      />
                    </Field>
                    <Field label="To year">
                      <input
                        inputMode="numeric"
                        className={inputClass}
                        value={row.is_current ? '' : row.end_year}
                        onChange={(e) => patchEducation(row.id, 'end_year', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        placeholder="2022"
                        disabled={row.is_current}
                      />
                    </Field>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={Boolean(row.is_current)}
                      onChange={(e) => patchEducation(row.id, 'is_current', e.target.checked)}
                    />
                    Studying here now
                  </label>
                  <button
                    onClick={() => saveEducationRow(row)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => removeEducation(row.id)}
                    className="text-xs font-semibold text-alert hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------- skills -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="section-skills">
        <h2 className="text-sm font-bold text-ink">Skills</h2>
        <p className="mt-1 text-xs text-mute">Used for match reasons — only claim what you can do.</p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1 text-sm font-bold">
            Add a skill
            <input
              className={inputClass}
              value={skillDraft.name}
              onChange={(e) => setSkillDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="Forklift operation"
              disabled={!dbReady}
            />
          </label>
          <label className="text-sm font-bold">
            Level
            <select
              className={`${inputClass} w-36`}
              value={skillDraft.level}
              onChange={(e) => setSkillDraft((d) => ({ ...d, level: e.target.value }))}
              disabled={!dbReady}
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <button
            onClick={addSkill}
            disabled={!dbReady || saving || !skillDraft.name.trim()}
            className="mb-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="add-skill"
          >
            Add
          </button>
        </div>

        {skills.length === 0 ? (
          <p className="mt-4 text-sm text-mute">{dbReady ? 'No skills yet.' : '—'}</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2" data-testid="skill-list">
            {skills.map((s) => (
              <li
                key={s.skill_id}
                className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm"
              >
                <span className="font-semibold text-ink">{s.name}</span>
                <span className="text-xs text-mute">
                  {SKILL_LEVELS.find((l) => l.id === s.level)?.label ?? s.level}
                </span>
                <button
                  onClick={() => removeSkill(s.skill_id)}
                  aria-label={`Remove ${s.name}`}
                  className="text-mute hover:text-alert"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ experience -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="section-experience">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink">Experience</h2>
            <p className="mt-1 text-xs text-mute">Newest first.</p>
          </div>
          <button
            onClick={addExperience}
            disabled={!dbReady || saving}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-mute disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="add-experience"
          >
            + Add
          </button>
        </div>

        {experience.length === 0 ? (
          <p className="mt-4 text-sm text-mute">{dbReady ? 'No experience added yet — fresher? Leave it empty, that is honest too.' : '—'}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {experience.map((row) => (
              <li key={row.id} className="rounded-lg border border-line p-4" data-testid="experience-row">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Role title">
                    <input
                      className={inputClass}
                      value={row.title ?? ''}
                      onChange={(e) => patchExperience(row.id, 'title', e.target.value)}
                    />
                  </Field>
                  <Field label="Company / household">
                    <input
                      className={inputClass}
                      value={row.company ?? ''}
                      onChange={(e) => patchExperience(row.id, 'company', e.target.value)}
                      placeholder="GreenLeaf Logistics"
                    />
                  </Field>
                  <Field label="Started">
                    <input
                      type="date"
                      className={inputClass}
                      value={row.start_date ?? ''}
                      onChange={(e) => patchExperience(row.id, 'start_date', e.target.value)}
                    />
                  </Field>
                  <Field label="Ended">
                    <input
                      type="date"
                      className={inputClass}
                      value={row.is_current ? '' : row.end_date ?? ''}
                      onChange={(e) => patchExperience(row.id, 'end_date', e.target.value)}
                      disabled={row.is_current}
                    />
                  </Field>
                </div>
                <Field label="What you did" className="mt-3">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={row.description ?? ''}
                    onChange={(e) => patchExperience(row.id, 'description', e.target.value)}
                  />
                </Field>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={Boolean(row.is_current)}
                      onChange={(e) => patchExperience(row.id, 'is_current', e.target.checked)}
                    />
                    I still work here
                  </label>
                  <button
                    onClick={() => saveExperienceRow(row)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => removeExperience(row.id)}
                    className="text-xs font-semibold text-alert hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  )
}

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block text-sm font-bold ${className}`}>
      {label}
      {hint && <span className="mb-1 block text-xs font-normal text-mute">{hint}</span>}
      {children}
    </label>
  )
}
