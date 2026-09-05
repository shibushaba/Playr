import { Header } from '@/components/layout/Header'
import { PageContent } from '@/components/motion/PageContent'
import { MotionTab, MotionTabBar } from '@/components/motion/MotionTab'
import { Icon } from '@/components/ui/Icon'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { useAuth } from '@/contexts/AuthContext'
import { ViewIcon, ViewOffSlashIcon } from '@/icons/actions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

/** Same-origin relative path only (must start with /; rejects // and protocols). */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  if (trimmed.includes('://')) return null
  return trimmed
}

export function AuthPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const nextPath = safeNextPath(search.get('next'))
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [phoneLocal, setPhoneLocal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isSupabaseConfigured) {
      setError(
        'This deployment is not connected to Supabase. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.',
      )
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your name.')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.')
        }
        if (phoneLocal.trim().length !== 10) {
          throw new Error('Enter your 10-digit mobile number.')
        }
        await signUp({
          email: email.trim(),
          password,
          displayName: name.trim(),
          phone: phoneLocal.trim(),
        })
      }
      navigate(
        mode === 'signup'
          ? `/welcome?next=${encodeURIComponent(nextPath ?? '/home')}`
          : (nextPath ?? '/home'),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't continue. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={mode === 'signin' ? 'Sign in' : 'Join PLAYR'} backTo="/" />
      <PageContent className="page-pad flex-1 py-6">
        <p className="text-[14px] leading-relaxed text-white/45">
          Email to join games, host, and keep your reliability history. PLAYR
          never handles payments.
        </p>

        {!isSupabaseConfigured ? (
          <div className="glass-status-warning mt-6 rounded-[8px] p-4">
            <p className="text-[13px] font-semibold text-status-warning">
              Server not connected
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              Supabase environment variables are missing or still set to
              placeholders. In Vercel → Settings → Environment Variables, add{' '}
              <code className="text-white">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-white">VITE_SUPABASE_PUBLISHABLE_KEY</code>,
              then redeploy (required — Vite bakes env at build time).
            </p>
          </div>
        ) : null}

        <MotionTabBar className="mt-6">
          <MotionTab active={mode === 'signin'} onClick={() => setMode('signin')}>
            Sign in
          </MotionTab>
          <MotionTab active={mode === 'signup'} onClick={() => setMode('signup')}>
            Sign up
          </MotionTab>
        </MotionTabBar>

        <form id="auth-form" className="mt-6 space-y-5" onSubmit={onSubmit}>
          {mode === 'signup' ? (
            <>
              <Field label="Full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </Field>
              <Field label="Mobile number">
                <div className="field flex min-h-12 items-center gap-2 !px-3">
                  <span className="text-[14px] text-white/45">+91</span>
                  <input
                    value={phoneLocal}
                    onChange={(e) =>
                      setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                    placeholder="9876543210"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-white/40">
                  Required. Hosts and players use this to coordinate games.
                </p>
              </Field>
            </>
          ) : null}
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field field-password"
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/40 transition hover:text-white"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <Icon icon={ViewOffSlashIcon} size={16} aria-hidden />
                ) : (
                  <Icon icon={ViewIcon} size={16} aria-hidden />
                )}
              </button>
            </div>
          </Field>

          {error ? (
            <p className="glass motion-error-in px-3 py-2 text-[13px] text-status-danger">
              {error}
            </p>
          ) : null}
        </form>
      </PageContent>

      <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-bg/90 px-5 py-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PrimaryButton
          type="submit"
          form="auth-form"
          fullWidth
          disabled={busy || !isSupabaseConfigured}
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </PrimaryButton>
        <button
          type="button"
          className="mt-3 flex min-h-11 w-full items-center justify-center text-[13px] font-medium text-white/45 transition hover:text-white"
          onClick={() => navigate('/home')}
        >
          Browse as guest
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/40">
          By continuing you agree that your phone may be shared with hosts and
          players in games you join.{' '}
          <Link
            to="/home"
            className="font-semibold text-white/70 underline-offset-2 hover:underline"
          >
            Browse games
          </Link>
        </p>
      </footer>

      <style>{`
        .field {
          width: 100%;
          min-height: 3rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          color: #fff;
          padding: 0 1rem;
          outline: none;
        }
        .field:focus {
          border-color: rgba(255, 255, 255, 0.45);
          background: rgba(255, 255, 255, 0.07);
        }
        .field-password {
          padding-right: 2.75rem;
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
