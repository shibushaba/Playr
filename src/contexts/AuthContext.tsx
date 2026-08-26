import { ensureProfileAfterSignup, getMyProfile } from '@/services/profiles'
import { authErrorMessage } from '@/lib/authErrors'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Tables<'profiles'> | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    email: string
    password: string
    displayName: string
  }) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getMyProfile()
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setSession(null)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      void refreshProfile()
    } else {
      setProfile(null)
    }
  }, [session?.user?.id, refreshProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Server not connected. The live app is missing Supabase settings — redeploy Vercel after adding VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      )
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(authErrorMessage(error, "Couldn't sign in. Try again."))
    }
  }, [])

  const signUp = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      if (!isSupabaseConfigured) {
        throw new Error(
          'Server not connected. The live app is missing Supabase settings — redeploy Vercel after adding env vars.',
        )
      }
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            display_name: input.displayName,
          },
        },
      })
      if (error) {
        throw new Error(authErrorMessage(error, "Couldn't create account. Try again."))
      }
      // Email-confirm projects return a user with no session until confirmed.
      if (data.user && !data.session) {
        throw new Error(
          'Almost done — check your email to confirm your account, then sign in.',
        )
      }
      if (data.user) {
        try {
          await ensureProfileAfterSignup({ displayName: input.displayName })
        } catch {
          // Profile trigger usually creates the row; never block signup on this.
        }
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error("Couldn't sign out. Try again.")
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
