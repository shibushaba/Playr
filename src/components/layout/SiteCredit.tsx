import { SITE_AUTHOR_URL } from '@/lib/site'

export function SiteCredit() {
  return (
    <footer className="pointer-events-none flex justify-center py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <a
        href={SITE_AUTHOR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto text-[10px] tracking-wide text-white/25 transition hover:text-white/45"
      >
        from shabas
      </a>
    </footer>
  )
}
