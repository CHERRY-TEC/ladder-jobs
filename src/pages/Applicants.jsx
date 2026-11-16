import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import EmployerNav from '../components/EmployerNav.jsx'
import ApplicationStagePill from '../components/ApplicationStagePill.jsx'
import { STAGE_LABELS } from '../data/ladder.js'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { relTime } from '../lib/format.js'

const NEXT = {
  applied: { to: 'viewed', label: 'Mark viewed' },
  viewed: { to: 'shortlisted', label: 'Shortlist' },
  shortlisted: { to: 'interview', label: 'Schedule interview' },
  interview: { to: 'selected', label: 'Select' },
}

/**
 * Employer applicant management — Phase 7.
 *
 * Lists the applications filed against the employer's own live jobs (the RLS
 * policy lets an employer read applications on their own jobs) and lets the
 * employer move candidates through the stage ladder. The database lock
 * (`ladder_applications_lock_status`) is what actually allows the employer to
 * change stages — this page only sends the move.
 */
export default function Applicants() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [jobs, setJobs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('ladder_employers')
      .select('id')
      .eq('owner_id', user.id)
      .then(async ({ data }) => {
        if (!alive) return
        const empIds = (data ?? []).map((e) => e.id)
        if (!empIds.length) {
          setRows([])
          setLoading(false)
          return
        }
        const { data: ownedJobs } = await supabase
          .from('ladder_jobs')
          .select('id, title, status')
          .in('employer_id', empIds)
        if (!alive) return
        const jobIds = (ownedJobs ?? []).map((j) => j.id)
        if (!jobIds.length) {
          setRows([])
          setLoading(false)
          return
        }
        const { data: apps } = await supabase
          .from('ladder_applications')
          .select(
            'id, job_id, profile_id, status, cover_note, created_at, job:ladder_jobs(id, title, status)',
          )
          .in('job_id', jobIds)
        if (!alive) return
        const list = (apps ?? []).filter((a) => a.job?.id)
        setRows(list)
        const map = {}
        for (const a of list) map[a.job_id] = a.job
        setJobs(map)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  const move = async (row, status) => {
    const { error } = await supabase.from('ladder_applications').update({ status }).eq('id', row.id)
    if (error) return
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)))
    if (status !== 'withdrawn') {
      const { error: notErr } = await supabase.from('ladder_notifications').insert({
        profile_id: row.profile_id,
        type: 'application.stage',
        title: 'Application stage updated',
        body: `Your application moved to ${STAGE_LABELS[status] ?? status}.`,
        link: `/jobs/${row.job_id}`,
      })
      if (notErr) console.warn('notification write failed:', notErr.message)
    }
  }

  const groups = rows.reduce((acc, row) => {
    const key = row.job_id
    if (!acc[key]) acc[key] = { job: row.job, rows: [] }
    acc[key].rows.push(row)
    return acc
  }, {})

  const groupList = Object.values(groups)

  return (
    <DashboardShell
      title="Applicants"
      subtitle="Candidates who applied to your vacancies — move them through the stages."
    >
      <EmployerNav />

      {!loading && rows.length === 0 && (
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="applicants-empty">
          <p className="font-semibold text-ink">No applicants yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            When a seeker applies to one of your live listings, the application shows up here.
          </p>
          <Link
            to="/employer/jobs"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Manage vacancies
          </Link>
        </div>
      )}

      {!loading &&
        groupList.map((g) => (
          <section key={g.job.id} className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="applicant-group">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-lg">{g.job.title}</h2>
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                {g.rows.length} applicant{g.rows.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {g.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0" data-testid="applicant-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ApplicationStagePill status={row.status} />
                      {row.cover_note && <span className="text-sm text-ink-soft">“{row.cover_note}”</span>}
                    </div>
                    <p className="mt-1 text-xs text-mute">{relTime(Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000))}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {NEXT[row.status] && (
                      <button
                        type="button"
                        onClick={() => move(row, NEXT[row.status].to)}
                        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                        data-testid={`applicant-move-${NEXT[row.status].to}`}
                      >
                        {NEXT[row.status].label}
                      </button>
                    )}
                    {row.status !== 'selected' && row.status !== 'withdrawn' && (
                      <button
                        type="button"
                        onClick={() => move(row, 'rejected')}
                        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-alert hover:border-alert"
                        data-testid="applicant-reject"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {loading && <p className="mt-6 text-sm text-mute">Loading applicants…</p>}
    </DashboardShell>
  )
}
