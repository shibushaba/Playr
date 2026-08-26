import { Header } from '@/components/layout/Header'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { PlayerAvatar } from '@/components/player/PlayerAvatar'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { toUserMessage } from '@/lib/errors'
import {
  getPlayerReliability,
  type PlayerReliability,
} from '@/services/reliability'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function ProfilePage() {
  const { user, profile, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<PlayerReliability | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void getPlayerReliability(user.id)
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch((e) => {
        if (!cancelled) setStatsError(toUserMessage(e, "Couldn't load stats."))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) {
    return (
      <div>
        <Header title="Profile" />
        <div className="page-pad py-8">
          <div className="glass h-40 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div>
        <Header title="Profile" />
        <div className="page-pad space-y-4 py-6">
          <p className="text-[14px] text-white/45">Sign in to view your PLAYR profile.</p>
          <PrimaryButton fullWidth onClick={() => navigate('/auth')}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    )
  }

  const name = profile?.display_name || user.email || 'Player'

  return (
    <div>
      <Header title="Profile" right={<NotificationBell />} />
      <div className="page-pad space-y-8 py-6">
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <PlayerAvatar
            player={{ name, avatarUrl: profile?.avatar_url }}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-tight text-white">
              {name}
            </h1>
            <p className="mt-1 text-[13px] text-white/45">
              {profile?.username ? `@${profile.username}` : user.email}
            </p>
          </div>
        </div>

        {profile?.bio ? (
          <p className="text-[14px] leading-relaxed text-white/70">{profile.bio}</p>
        ) : null}

        <p className="text-[12px] text-white/45">
          {profile?.phone
            ? `Phone on file (visible only to hosts of games you join): ${profile.phone}`
            : 'Add a phone later so hosts can reach you after you join.'}
        </p>

        <section>
          <p className="label-caps">Reliability</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">
            {stats ? stats.label : 'Trust, not popularity'}
          </h2>
          {statsError ? (
            <p className="mt-2 text-[14px] text-white/45">{statsError}</p>
          ) : stats ? (
            <dl className="glass mt-5 space-y-3 p-4">
              <StatRow label="Games joined" value={stats.gamesJoined} />
              <StatRow label="Attended" value={stats.attended} />
              <StatRow label="Late cancellations" value={stats.lateCancellations} />
              <StatRow label="No-shows" value={stats.noShows} />
              {stats.attendanceRate != null ? (
                <StatRow label="Attendance rate" value={`${stats.attendanceRate}%`} />
              ) : null}
              {stats.gamesHosted > 0 ? (
                <>
                  <div className="border-t border-white/10 pt-3">
                    <p className="label-caps">Host</p>
                  </div>
                  <StatRow label="Games hosted" value={stats.gamesHosted} />
                  <StatRow label="Completed" value={stats.hostedCompleted} />
                  <StatRow label="Cancelled" value={stats.hostedCancelled} />
                  {stats.completionRate != null ? (
                    <StatRow
                      label="Completion rate"
                      value={`${stats.completionRate}%`}
                    />
                  ) : null}
                </>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              Reliability comes from attendance, no-shows, cancellations, and
              game history — not likes or followers.
            </p>
          )}
        </section>

        <div className="glass overflow-hidden">
          <Row to="/my-games" label="Upcoming / past games" />
          <Row to="/groups" label="My groups" />
          <Row to="/notifications" label="Notifications" />
          <Row to="/venues/new?returnTo=create-game" label="Submit a venue" />
        </div>

        <div className="glass-elevated p-5">
          <p className="label-caps">Host</p>
          <p className="mt-2 text-[18px] font-semibold tracking-tight text-white">
            Ready to host?
          </p>
          <p className="mt-1 text-[13px] text-white/45">
            You book the venue. PLAYR helps you fill the roster.
          </p>
          <Link to="/host" className="mt-5 block">
            <PrimaryButton fullWidth>
              Host a game
            </PrimaryButton>
          </Link>
        </div>

        <SecondaryButton
          fullWidth
          onClick={() => {
            void signOut().then(() => navigate('/'))
          }}
        >
          Sign out
        </SecondaryButton>

        <p className="text-center text-[12px] text-white/45">
          PLAYR never handles money. Fees stay offline between players and hosts.
        </p>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-white/45">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums text-white">{value}</dd>
    </div>
  )
}

function Row({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 last:border-0 transition hover:bg-white/[0.04]"
    >
      <span className="text-[14px] font-medium text-white">{label}</span>
      <ChevronRight className="h-4 w-4 text-white/45" />
    </Link>
  )
}
