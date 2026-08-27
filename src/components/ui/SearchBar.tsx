import { cn } from '@/lib/format'
import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search games, venues, sports…',
  className,
}: Props) {
  return (
    <label
      className={cn(
        'glass motion-glass flex min-h-12 items-center gap-3 px-4 transition-[border-color,background-color,box-shadow] duration-[var(--motion-fast)] focus-within:border-white/25 focus-within:bg-white/[0.06]',
        className,
      )}
    >
      <Search
        className={cn(
          'h-4 w-4 shrink-0 transition-opacity duration-[var(--motion-fast)]',
          value ? 'text-white/55' : 'text-white/40',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
        type="search"
        enterKeyHint="search"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="motion-icon-btn motion-clear-in h-8 w-8 rounded-[6px] border-0 bg-transparent p-0 text-white/40 shadow-none hover:bg-white/[0.06]"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </label>
  )
}
