import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { toUserMessage } from '@/lib/errors'
import {
  searchAdminUsers,
  suspendUser,
  unsuspendUser,
  type AdminUserSearchItem,
} from '@/services/admin'
import { useState } from 'react'

function UserRow({
  item,
  onAction,
}: {
  item: AdminUserSearchItem
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspended = Boolean(item.suspended_at)

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (suspended) await unsuspendUser(item.id)
      else await suspendUser(item.id)
      onAction()
    } catch (e) {
      setError(toUserMessage(e, 'Action failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-white">
            {item.display_name ?? 'Unnamed'}
          </p>
          {item.username ? (
            <p className="text-[12px] text-white/45">@{item.username}</p>
          ) : null}
        </div>
        {suspended ? (
          <span className="text-[11px] font-semibold uppercase text-status-danger">
            Suspended
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[12px] text-white/45">
        Joined {item.games_joined} · Hosted {item.games_hosted}
      </p>
      <div className="mt-4">
        {suspended ? (
          <SecondaryButton type="button" disabled={busy} onClick={() => void toggle()}>
            Unsuspend
          </SecondaryButton>
        ) : (
          <PrimaryButton type="button" disabled={busy} onClick={() => void toggle()}>
            Suspend
          </PrimaryButton>
        )}
      </div>
      {error ? <p className="mt-2 text-[12px] text-status-danger">{error}</p> : null}
    </div>
  )
}

export function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserSearchItem[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const q = query.trim()
    if (q.length < 2) {
      setError('Enter at least 2 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setResults(await searchAdminUsers(q))
      setSearched(true)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't search users."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps text-white/45">Accounts</p>
        <h1 className="display-lg mt-2">Users</h1>
      </header>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search()
          }}
          placeholder="Search by name or username"
          className="glass flex-1 rounded-xl px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35"
        />
        <PrimaryButton type="button" disabled={busy} onClick={() => void search()}>
          Search
        </PrimaryButton>
      </div>

      {error ? <p className="text-[13px] text-status-danger">{error}</p> : null}

      {results.length ? (
        <div className="space-y-3">
          {results.map((u) => (
            <UserRow
              key={u.id}
              item={u}
              onAction={() => void search()}
            />
          ))}
        </div>
      ) : searched ? (
        <EmptyState title="No users found" description="Try a different search." />
      ) : (
        <EmptyState
          title="Search users"
          description="Find accounts by display name or username."
        />
      )}
    </div>
  )
}
