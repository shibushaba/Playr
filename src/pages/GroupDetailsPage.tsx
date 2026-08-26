import { GameCard } from '@/components/game/GameCard'
import { Header } from '@/components/layout/Header'
import { PlayerAvatar } from '@/components/player/PlayerAvatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import { createGroupInvite } from '@/services/invites'
import {
  getGroup,
  getGroupHealth,
  getMyRsvp,
  joinPublicGroup,
  leaveGroup,
  listGroupMembers,
  listGroupPastGames,
  listGroupUpcomingGames,
  setGameRsvp,
  setGroupActive,
} from '@/services/groups'
import { getPublicProfile } from '@/services/profiles'
import type {
  GameListItem,
  GroupHealth,
  GroupListItem,
  GroupMember,
  PublicProfile,
} from '@/types/domain'
import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

export function GroupDetailsPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const justCreated = search.get('created') === '1'
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState<GroupListItem | null>(null)
  const [host, setHost] = useState<PublicProfile | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [upcoming, setUpcoming] = useState<GameListItem[]>([])
  const [past, setPast] = useState<GameListItem[]>([])
  const [health, setHealth] = useState<GroupHealth | null>(null)
  const [rsvps, setRsvps] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function reload() {
    if (!id) return
    const g = await getGroup(id)
    if (!g) {
      setError('Group not found.')
      return
    }
    const [profile, memberList, up, pastGames, healthData] = await Promise.all([
      getPublicProfile(g.hostId),
      listGroupMembers(id).catch(() => [] as GroupMember[]),
      listGroupUpcomingGames(id, 5),
      listGroupPastGames(id, 5),
      getGroupHealth(id).catch(() => null),
    ])
    setGroup(g)
    setHost(profile)
    setMembers(memberList)
    setUpcoming(up)
    setPast(pastGames)
    setHealth(healthData)

    if (user) {
      const map: Record<string, string> = {}
      await Promise.all(
        up.map(async (game) => {
          const r = await getMyRsvp(game.id).catch(() => null)
          if (r?.response) map[game.id] = r.response
        }),
      )
      setRsvps(map)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (e) {
        if (!cancelled) setError(toUserMessage(e, "Couldn't load group. Try again."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  if (loading) {
    return (
      <div>
        <Header title="Group" backTo="/groups" />
        <div className="page-pad py-8">
          <div className="glass h-40 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div>
        <Header title="Group" backTo="/groups" />
        <div className="page-pad py-6">
          <EmptyState title="Group unavailable" description={error ?? undefined} />
        </div>
      </div>
    )
  }

  const isHost = user?.id === group.hostId
  const membership = members.find((m) => m.userId === user?.id && m.status === 'active')
  const isMember = Boolean(isHost || membership)
  const isCoHost = membership?.role === 'co_host' || membership?.role === 'host'

  async function onJoin() {
    if (!user) {
      navigate(`/auth?next=/groups/${group!.id}`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await joinPublicGroup(group!.id)
      await reload()
    } catch (e) {
      setError(toUserMessage(e, "Couldn't join group."))
    } finally {
      setBusy(false)
    }
  }

  async function onLeave() {
    setBusy(true)
    try {
      await leaveGroup(group!.id)
      navigate('/groups')
    } catch (e) {
      setError(toUserMessage(e, "Couldn't leave group."))
    } finally {
      setBusy(false)
    }
  }

  async function onInvite() {
    setBusy(true)
    try {
      const inv = await createGroupInvite({ groupId: group!.id })
      const url = `${window.location.origin}/join/group/${inv.token}`
      setInviteLink(url)
    } catch (e) {
      setError(toUserMessage(e, "Couldn't create invite."))
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const healthLabel = health?.label ?? null

  return (
    <div className="pb-10">
      <Header title="Group" backTo="/groups" />
      <div className="page-pad space-y-8 py-6">
        {justCreated ? (
          <div className="glass-elevated p-4">
            <p className="label-caps">Ready</p>
            <p className="mt-2 text-[16px] font-semibold tracking-tight text-white">
              Your recurring group is ready.
            </p>
            {upcoming[0] ? (
              <p className="mt-1 text-[13px] text-muted">
                Next game:{' '}
                {upcoming[0].startsAt
                  ? new Date(upcoming[0].startsAt).toLocaleString()
                  : upcoming[0].gameDate}
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-muted">
                Upcoming games appear as the server generates the next 14 days.
              </p>
            )}
          </div>
        ) : null}

        {error ? (
          <p className="glass px-3 py-2 text-[13px] text-white">
            {error}
          </p>
        ) : null}

        {/* Club header */}
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <p className="label-caps">{group.sport.name}</p>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {group.isActive ? 'Active' : 'Paused'}
            </span>
            {healthLabel ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {healthLabel}
              </span>
            ) : null}
          </div>
          <h1 className="display-xl mt-4">
            {group.name}
          </h1>
          {group.description ? (
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              {group.description}
            </p>
          ) : null}
        </header>

        {/* Meta strip */}
        <div className="glass grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="label-caps">Schedule</p>
            <p className="mt-1 text-[15px] font-medium text-white">
              {group.recurrenceLabel}
            </p>
            <p className="text-[13px] text-white/45">{group.timeLabel}</p>
          </div>
          <div>
            <p className="label-caps">Venue</p>
            <p className="mt-1 text-[15px] font-medium text-white">
              {group.venue?.name ?? 'Venue'}
            </p>
            <p className="text-[13px] text-white/45">{group.venue?.city ?? ''}</p>
          </div>
          <div>
            <p className="label-caps">Players</p>
            <p className="mt-1 text-[15px] font-medium text-white">
              {group.minPlayers}–{group.maxPlayers}
            </p>
            <p className="text-[13px] capitalize text-white/45">
              {group.visibility.replace('_', ' ')}
            </p>
          </div>
        </div>

        {group.autoOpenMissingSpots ? (
          <p className="glass px-3 py-2 text-[13px] text-white/45">
            Auto-open missing spots is on. Regulars get ~{group.priorityHours ?? 6}h
            priority, then remaining seats can appear in nearby discovery.
          </p>
        ) : null}

        <p className="text-[13px] leading-relaxed text-muted">
          Recurring groups are templates. Each occurrence is its own game. Venue
          changes only apply to newly generated games.
        </p>

        {host ? (
          <section>
            <p className="label-caps mb-3">Host</p>
            <PlayerAvatar
              player={{ name: host.displayName, avatarUrl: host.avatarUrl }}
              showName
            />
          </section>
        ) : null}

        <section>
          <p className="label-caps mb-3">Members</p>
          <div className="glass divide-y divide-white/10">
            {members
              .filter((m) => m.status === 'active')
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <PlayerAvatar
                    player={{
                      name: m.profile.displayName,
                      avatarUrl: m.profile.avatarUrl,
                    }}
                    showName
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    {m.role === 'host'
                      ? 'Host'
                      : m.role === 'co_host'
                        ? 'Co-host'
                        : 'Member'}
                  </span>
                </div>
              ))}
            {members.filter((m) => m.status === 'active').length === 0 ? (
              <p className="py-4 text-[13px] text-muted">No members yet.</p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="section-label mb-4">
            Upcoming
          </h2>
          {upcoming.length ? (
            <div className="space-y-4">
              {upcoming.map((g) => {
                const confirmed = g.confirmedCount
                const openSpots = Math.max(0, g.maxPlayers - confirmed)
                const regularsNote =
                  group.autoOpenMissingSpots && openSpots > 0
                    ? `${confirmed} regulars are playing. ${openSpots} spots open to nearby players.`
                    : null
                return (
                  <div key={g.id} className="space-y-2">
                    <GameCard game={g} />
                    {regularsNote && isMember ? (
                      <p className="text-[12px] text-muted">{regularsNote}</p>
                    ) : null}
                    {isMember && g.dbStatus === 'open' ? (
                      <div className="flex flex-wrap gap-2">
                        <PrimaryButton
                          size="md"
                          className="!min-h-10 text-[13px]"
                          onClick={() => navigate(`/games/${g.id}/join`)}
                        >
                          I&apos;m in
                        </PrimaryButton>
                        <SecondaryButton
                          className="!min-h-10 text-[13px]"
                          onClick={() => {
                            void setGameRsvp(g.id, 'maybe').then(() =>
                              setRsvps((prev) => ({ ...prev, [g.id]: 'maybe' })),
                            )
                          }}
                        >
                          {rsvps[g.id] === 'maybe' ? 'Maybe ✓' : 'Maybe'}
                        </SecondaryButton>
                        <SecondaryButton
                          className="!min-h-10 text-[13px]"
                          onClick={() => {
                            void setGameRsvp(g.id, 'out').then(() =>
                              setRsvps((prev) => ({ ...prev, [g.id]: 'out' })),
                            )
                          }}
                        >
                          {rsvps[g.id] === 'out' ? "Can't ✓" : "Can't make it"}
                        </SecondaryButton>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-muted">Nothing scheduled yet.</p>
          )}
        </section>

        <section>
          <h2 className="section-label mb-4">
            Past
          </h2>
          {past.length ? (
            <div className="glass divide-y divide-white/10">
              {past.map((g) => (
                <Link
                  key={g.id}
                  to={`/games/${g.id}`}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-[14px] font-medium text-white">{g.gameDate}</p>
                    <p className="text-[12px] text-muted">
                      {g.confirmedCount}/{g.maxPlayers}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    {g.dbStatus}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">No past games yet.</p>
          )}
          {health && health.sampleSize >= 3 ? (
            <p className="mt-3 text-[13px] text-muted">
              Completed {health.completed ?? 0} · Cancelled {health.cancelled ?? 0}
              {health.completionRate != null
                ? ` · Completion ${Math.round(health.completionRate * 100)}%`
                : null}
            </p>
          ) : null}
        </section>

        {inviteLink ? (
          <div className="glass space-y-2 p-4">
            <p className="label-caps">Invite link</p>
            <p className="break-all text-[12px] text-muted">{inviteLink}</p>
            <SecondaryButton fullWidth onClick={() => void copyInvite()}>
              <span className="inline-flex items-center gap-2">
                <Copy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy link'}
              </span>
            </SecondaryButton>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {isHost || isCoHost ? (
            <>
              <SecondaryButton fullWidth disabled={busy} onClick={() => void onInvite()}>
                Invite members
              </SecondaryButton>
              {isHost ? (
                <SecondaryButton
                  fullWidth
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    void setGroupActive(group.id, !group.isActive)
                      .then((g) => setGroup(g))
                      .catch((e) => setError(toUserMessage(e, "Couldn't update group.")))
                      .finally(() => setBusy(false))
                  }}
                >
                  {group.isActive ? 'Pause group' : 'Resume group'}
                </SecondaryButton>
              ) : null}
            </>
          ) : null}

          {!isMember && group.visibility === 'public' ? (
            <PrimaryButton fullWidth disabled={busy} onClick={() => void onJoin()}>
              Join group
            </PrimaryButton>
          ) : null}

          {!isMember && group.visibility === 'invite_only' ? (
            <div className="glass space-y-3 p-4">
              <p className="text-[13px] text-white/45">
                This group is invite-only. Open an invite link from the host, or
                ask them to share one.
              </p>
              <PrimaryButton
                fullWidth
                onClick={() => {
                  const code = window.prompt('Paste invite code or token')
                  if (code?.trim()) navigate(`/join/group/${code.trim()}`)
                }}
              >
                Enter invite
              </PrimaryButton>
            </div>
          ) : null}

          {isMember && !isHost ? (
            <SecondaryButton fullWidth disabled={busy} onClick={() => void onLeave()}>
              Leave group
            </SecondaryButton>
          ) : null}

          <Link to="/host">
            <SecondaryButton fullWidth>Host a one-off game</SecondaryButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
