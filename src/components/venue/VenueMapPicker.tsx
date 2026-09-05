import { Icon } from '@/components/ui/Icon'
import { Link01Icon } from '@/icons/actions'
import { Search01Icon } from '@/icons/navigation'
import { useMemo, useState } from 'react'
import {
  areaNameFromLabel,
  mapUrlParseHint,
  osmEmbedUrl,
  placeFromMapUrl,
  searchPlaces,
  type PlaceSuggestion,
} from '@/lib/maps'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { useLocationDiscovery } from '@/contexts/LocationContext'

interface Props {
  onConfirm: (place: PlaceSuggestion) => void
  confirmed: PlaceSuggestion | null
}

export function VenueMapPicker({ onConfirm, confirmed }: Props) {
  const { location } = useLocationDiscovery()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSuggestion[]>([])
  const [selected, setSelected] = useState<PlaceSuggestion | null>(confirmed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPasteLink, setShowPasteLink] = useState(!location)
  const [mapLink, setMapLink] = useState('')
  const [linkName, setLinkName] = useState('')

  const areaHint = useMemo(
    () => areaNameFromLabel(location?.label),
    [location?.label],
  )

  const searchPlaceholder = areaHint
    ? `e.g. football turf near ${areaHint}`
    : location
      ? 'e.g. football turf near you'
      : 'e.g. football turf near Kozhikode'

  async function runSearch() {
    const q = query.trim()
    if (q.length < 2) {
      setError('Type a place name to search.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const list = location
        ? await searchPlaces(q, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            areaLabel: location.label,
            countryCode: 'in',
            maxRadiusMeters: 100_000,
          })
        : await searchPlaces(q)
      setResults(list)
      if (list.length === 0) {
        setError(
          areaHint
            ? `No places found near ${areaHint}. Paste a map link below, or try a more specific search.`
            : 'No places found. Include the city in your search, or paste a map link below.',
        )
        setShowPasteLink(true)
      }
    } catch {
      setError("Couldn't search places. Try again or paste a map link below.")
      setShowPasteLink(true)
    } finally {
      setBusy(false)
    }
  }

  function applyMapLink() {
    const url = mapLink.trim()
    if (!url) {
      setError('Paste a Google Maps link first.')
      return
    }

    const place = placeFromMapUrl(url, linkName.trim() || query.trim())
    if (!place) {
      setError(mapUrlParseHint())
      return
    }

    setError(null)
    setSelected(place)
    setResults([])
  }

  function confirmSelection(place: PlaceSuggestion) {
    setSelected(place)
    onConfirm(place)
  }

  const preview = selected ?? confirmed

  return (
    <div className="space-y-4">
      <div>
        <p className="label-caps">Location</p>
        <p className="mt-1 text-[13px] text-white/45">
          Search and select the exact venue on the map, or paste a map link if
          it is not listed.
        </p>
      </div>

      <div className="flex gap-2">
        <label className="glass-input flex min-h-12 flex-1 items-center gap-2 !px-3">
          <Icon icon={Search01Icon} size={16} className="shrink-0 text-white/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runSearch()
              }
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
            aria-label="Search location"
          />
        </label>
        <PrimaryButton
          type="button"
          disabled={busy}
          onClick={() => void runSearch()}
          className="shrink-0 px-4"
        >
          {busy ? '…' : 'Search'}
        </PrimaryButton>
      </div>

      {!location ? (
        <p className="glass px-3 py-2 text-[13px] text-white/70">
          Search with a city name (e.g. “turf Kozhikode”), or paste a Google
          Maps link below.
        </p>
      ) : null}

      {error ? (
        <p className="glass px-3 py-2 text-[13px] text-white">{error}</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="glass max-h-72 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className={
                  selected?.id === r.id
                    ? 'w-full border-b border-white/10 bg-white/[0.12] px-3 py-3 text-left text-white last:border-0'
                    : 'w-full border-b border-white/10 px-3 py-3 text-left text-white/85 transition last:border-0 hover:bg-white/[0.04]'
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="block text-[14px] font-medium">{r.name}</span>
                  {r.distanceLabel ? (
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/45">
                      {r.distanceLabel}
                    </span>
                  ) : null}
                </div>
                <span
                  className={
                    selected?.id === r.id
                      ? 'mt-0.5 block text-[12px] text-white/70'
                      : 'mt-0.5 block text-[12px] text-white/45'
                  }
                >
                  {[r.city, r.state, r.country].filter(Boolean).join(', ') ||
                    r.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="glass space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps">Or paste map link</p>
            <p className="mt-1 text-[12px] text-white/45">
              Open the venue in Google Maps → Share → Copy link, then paste it
              here.
            </p>
          </div>
          {!showPasteLink ? (
            <SecondaryButton
              type="button"
              className="shrink-0 px-3 py-2 text-[11px]"
              onClick={() => setShowPasteLink(true)}
            >
              Paste link
            </SecondaryButton>
          ) : null}
        </div>

        {showPasteLink ? (
          <div className="space-y-3">
            <label className="glass-input flex min-h-12 items-center gap-2 !px-3">
              <Icon icon={Link01Icon} size={16} className="shrink-0 text-white/45" />
              <input
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                aria-label="Map link"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
                Venue name (optional)
              </span>
              <input
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Soccer 7 Arena"
                className="glass-input min-h-12 w-full px-3 text-[14px] text-white outline-none placeholder:text-white/35"
              />
            </label>
            <PrimaryButton type="button" fullWidth onClick={applyMapLink}>
              Use this map link
            </PrimaryButton>
          </div>
        ) : null}
      </div>

      {preview && selected ? (
        <div className="glass overflow-hidden">
          <iframe
            title="Map preview"
            className="map-frame h-48 w-full border-0"
            src={osmEmbedUrl(selected.latitude, selected.longitude)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="space-y-2 border-t border-white/10 p-4">
            <p className="text-[14px] font-medium text-white">{selected.name}</p>
            <p className="text-[13px] text-white/45">
              {[selected.address, selected.distanceLabel, selected.provider === 'manual' ? 'From map link' : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <SecondaryButton
              type="button"
              fullWidth
              onClick={() => confirmSelection(selected)}
            >
              Use this location
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {confirmed ? (
        <div className="glass-elevated p-4">
          <p className="label-caps">Confirmed location</p>
          <p className="mt-2 text-[15px] font-medium text-white">{confirmed.name}</p>
          <p className="mt-1 text-[13px] text-white/45">
            {[confirmed.city, confirmed.address, confirmed.provider === 'manual' ? 'From map link' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
