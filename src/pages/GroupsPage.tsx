import { GroupCard } from '@/components/group/GroupCard'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { toUserMessage } from '@/lib/errors'
import { listGroups } from '@/services/groups'
import type { GroupListItem } from '@/types/domain'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listGroups()
      .then(setGroups)
      .catch((e) => setError(toUserMessage(e, "Couldn't load groups. Try again.")))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Header
        title="Clubs"
        subtitle="Recurring crews"
        right={
          <Link
            to="/groups/new"
            className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45 transition hover:text-white"
          >
            New
          </Link>
        }
      />
      <div className="page-pad space-y-4 py-5">
        <p className="text-[14px] leading-relaxed text-white/45">
          Daily, weekly, custom — every occurrence becomes its own game with its
          own roster, deadline, and attendance.
        </p>
        {loading ? (
          <div className="glass h-32 animate-pulse" />
        ) : error ? (
          <EmptyState title="Couldn't load groups" description={error} />
        ) : groups.length === 0 ? (
          <EmptyState
            title="Create a regular game group."
            description="Set a schedule once. PLAYR creates each game occurrence."
            action={
              <Link to="/groups/new">
                <PrimaryButton>Create group</PrimaryButton>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
        <div className="pt-2">
          <Link to="/groups/new">
            <PrimaryButton fullWidth>Create a recurring group</PrimaryButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
