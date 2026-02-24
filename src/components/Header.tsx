import { NavLink } from 'react-router-dom'

export function Header() {
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <h1 className="text-2xl font-semibold">Crux</h1>
      <div className="flex gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `rounded-md px-3 py-1 text-sm ${
              isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-200'
            }`
          }
          end
        >
          Recorder
        </NavLink>
        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            `rounded-md px-3 py-1 text-sm ${
              isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-200'
            }`
          }
        >
          Sessions
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `rounded-md px-3 py-1 text-sm ${
              isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-200'
            }`
          }
        >
          Settings
        </NavLink>
      </div>
    </div>
  )
}
