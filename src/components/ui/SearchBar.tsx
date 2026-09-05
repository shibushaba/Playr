import { Icon } from '@/components/ui/Icon'
import { Cancel01Icon } from '@/icons/actions'
import { Search01Icon } from '@/icons/navigation'
import { cn } from '@/lib/format'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search games, venues, clubs…',
  className,
  autoFocus,
}: Props) {
  return (
    <label
      className={cn(
        'glass motion-glass flex min-h-12 items-center gap-3 px-4 transition-[border-color,background-color,box-shadow] duration-[var(--motion-fast)] focus-within:border-white/25 focus-within:bg-white/[0.06]',
        className,
      )}
    >
      <Icon
        icon={Search01Icon}
        size={18}
        className={cn(
          'shrink-0 transition-opacity duration-[var(--motion-fast)]',
          value ? 'text-white/55' : 'text-white/40',
        )}
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
        autoFocus={autoFocus}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="motion-icon-btn motion-clear-in flex h-11 w-11 items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-white/40 shadow-none hover:bg-white/[0.06]"
        >
          <Icon icon={Cancel01Icon} size={16} />
        </button>
      ) : null}
    </label>
  )
}
