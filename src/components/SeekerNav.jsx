import { NavLink } from 'react-router-dom'

const items = [
  { to: '/me', label: 'Overview', end: true },
  { to: '/me/applications', label: 'My Applications' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/profile', label: 'My Profile' },
  { to: '/me/resume', label: 'My Resume' },
  { to: '/me/settings', label: 'Settings' },
]

export default function SeekerNav() {
  return (
    <nav
      aria-label="Seeker dashboard"
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
