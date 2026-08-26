import { Header } from '@/components/layout/Header'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { useAuth } from '@/contexts/AuthContext'
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
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
        await signUp({
          email: email.trim(),
          password,
          displayName: name.trim(),
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
    <div className="min-h-dvh">
      <Header title={mode === 'signin' ? 'Sign in' : 'Join PLAYR'} backTo="/" />
      <div className="page-pad py-8">
        <p className="text-[14px] leading-relaxed text-white/45">
          Sign in with email to join games, host, and keep your reliability
          history. PLAYR never handles payments.
        </p>

        <div className="glass mt-8 flex overflow-hidden">
          <ModeTab active={mode === 'signin'} onClick={() => setMode('signin')}>
            Sign in
          </ModeTab>
          <ModeTab active={mode === 'signup'} onClick={() => setMode('signup')}>
            Sign up
          </ModeTab>
        </div>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          {mode === 'signup' ? (
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
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
            />
          </Field>

          {error ? (
            <p className="glass px-3 py-2 text-[13px] text-white">
              {error}
            </p>
          ) : null}

          <PrimaryButton type="submit" fullWidth disabled={busy}>
            {busy ? 'Please wait…' : 'Continue'}
          </PrimaryButton>
          <PrimaryButton
            type="button"
            fullWidth
            variant="outline"
            onClick={() => navigate('/home')}
          >
            Browse as guest
          </PrimaryButton>
        </form>

        <p className="mt-10 text-center text-[12px] leading-relaxed text-white/45">
          By continuing you agree that hosts may see your phone if you add one
          and join a game, and that PLAYR does not process payments.{' '}
          <Link to="/home" className="font-semibold text-white underline-offset-2 hover:underline">
            Browse games
          </Link>
        </p>
      </div>

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
      <span className="label-caps mb-2 block">{label}</span>
      {children}
    </label>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex-1 bg-white py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-cta'
          : 'flex-1 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45 transition hover:text-white'
      }
    >
      {children}
    </button>
  )
}
