import { useLocationDiscovery } from '@/contexts/LocationContext'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export function LocationPickerSheet() {
  const {
    pickerOpen,
    setPickerOpen,
    areas,
    areasLoading,
    chooseManualArea,
    clearManualAndRetry,
    permission,
    location,
  } = useLocationDiscovery()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return areas
    return areas.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.state?.toLowerCase().includes(query) ?? false),
    )
  }, [areas, q])

  if (!pickerOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setPickerOpen(false)}
      />
      <div className="glass-overlay relative z-10 max-h-[80dvh] w-full max-w-lg overflow-hidden sm:rounded-[8px]">
        <div className="border-b border-white/10 px-5 py-5">
          <h2 className="text-[18px] font-semibold tracking-tight text-white">
            Choose your area
          </h2>
          <p className="mt-1 text-[13px] text-white/45">
            {permission === 'denied' || permission === 'unavailable'
              ? 'Location access is off. Pick a city where PLAYR has games or venues.'
              : 'Only cities with PLAYR games or venues are listed.'}
          </p>
          {areas.length > 0 ? (
            <label className="glass-input mt-4 flex min-h-11 items-center gap-2 !px-3">
              <Search className="h-4 w-4 text-white/45" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search city or area"
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
              />
            </label>
          ) : null}
        </div>
        <div className="max-h-[50dvh] overflow-y-auto">
          {areasLoading ? (
            <p className="px-5 py-8 text-[14px] text-white/45">Loading areas…</p>
          ) : areas.length === 0 ? (
            <div className="space-y-4 px-5 py-8">
              <p className="text-[15px] font-medium text-white">
                PLAYR hasn&apos;t reached your area yet.
              </p>
              <p className="text-[13px] text-white/45">
                Add a venue or create a game to get started.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  to="/venues/new?returnTo=create-game"
                  onClick={() => setPickerOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-[8px] bg-white text-cta text-[12px] font-semibold uppercase tracking-[0.08em]"
                >
                  Add a venue
                </Link>
                <Link
                  to="/host"
                  onClick={() => setPickerOpen(false)}
                  className="glass flex min-h-11 items-center justify-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/20"
                >
                  Create a game
                </Link>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-white/45">No areas match.</p>
          ) : (
            filtered.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => chooseManualArea(area)}
                className="flex w-full flex-col border-b border-white/10 px-5 py-3.5 text-left last:border-0 transition hover:bg-white/[0.04]"
              >
                <span className="text-[15px] font-medium text-white">{area.name}</span>
                <span className="mt-0.5 text-[12px] text-white/45">
                  {[
                    area.state,
                    area.gameCount != null
                      ? `${area.gameCount} games`
                      : null,
                    area.venueCount != null
                      ? `${area.venueCount} venues`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="space-y-2 border-t border-white/10 p-4">
          {location?.source === 'manual' ? (
            <button
              type="button"
              onClick={() => clearManualAndRetry()}
              className="min-h-11 w-full rounded-[8px] bg-white text-cta text-[12px] font-semibold uppercase tracking-[0.08em]"
            >
              Use my location
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => clearManualAndRetry()}
            className="glass min-h-11 w-full text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-white/20"
          >
            Try location again
          </button>
        </div>
      </div>
    </div>
  )
}
