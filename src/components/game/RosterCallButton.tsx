import { CallButton } from '@/components/game/CallButton'
import { getContactPhone } from '@/services/games'
import { useEffect, useState } from 'react'

interface Props {
  gameId: string
  userId: string
  displayName: string
  phone?: string | null
}

/** Host roster call — uses cached phone or fetches via contact RPC. */
export function RosterCallButton({ gameId, userId, displayName, phone }: Props) {
  const [resolved, setResolved] = useState<string | null>(phone ?? null)

  useEffect(() => {
    if (phone) {
      setResolved(phone)
      return
    }
    let cancelled = false
    void getContactPhone(gameId, userId).then((p) => {
      if (!cancelled) setResolved(p)
    })
    return () => {
      cancelled = true
    }
  }, [gameId, userId, phone])

  if (!resolved) return null

  return (
    <CallButton
      phone={resolved}
      label={`Call ${displayName}`}
      iconOnly
    />
  )
}
