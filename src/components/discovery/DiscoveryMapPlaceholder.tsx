interface Props {
  label: string
  hasKey: boolean
  venueCount: number
}

/** Minimal area note — list discovery never depends on a map. */
export function DiscoveryMapPlaceholder({ label, hasKey, venueCount }: Props) {
  return (
    <div className="glass px-4 py-3">
      <p className="label-caps">Area</p>
      <p className="mt-1 text-[14px] font-medium text-white">{label}</p>
      <p className="mt-1 text-[13px] text-white/45">
        {venueCount > 0
          ? `${venueCount} venue${venueCount === 1 ? '' : 's'} near ${label}.`
          : hasKey
            ? `No venues near ${label} yet.`
            : `Browse venues near ${label} in the list.`}
      </p>
    </div>
  )
}
