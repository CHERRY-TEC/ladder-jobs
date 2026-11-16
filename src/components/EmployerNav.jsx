import { NavLink } from 'react-router-dom'

const items = [
  { to: '/employer', label: 'Overview', end: true },
  { to: '/employer/company', label: 'Company' },
  { to: '/employer/jobs', label: 'Vacancies' },
  { to: '/employer/applicants', label: 'Applicants' },
  { to: '/employer/verification', label: 'Verification' },
]

export default function EmployerNav() {
  return (
    <nav
      aria-label="Employer dashboard"
      className="mt-6 flex flex-wrap gap-1 border-b border-line"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-accent text-ink'
                : 'border-transparent text-mute hover:text-ink'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
