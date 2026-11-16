import { NavLink } from 'react-router-dom'

const items = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/verifications', label: 'Employer verification' },
  { to: '/admin/jobs', label: 'Job moderation' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit', label: 'Audit log' },
  { to: '/admin/analytics', label: 'Analytics' },
]

export default function AdminNav() {
  return (
    <nav
      aria-label="Admin dashboard"
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
