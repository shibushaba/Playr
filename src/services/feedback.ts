import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type FeedbackKind = 'feedback' | 'suggestion'

export type AppFeedbackRow = Tables<'app_feedback'>

export async function submitAppFeedback(input: {
  kind: FeedbackKind
  message: string
  pagePath?: string | null
}): Promise<AppFeedbackRow> {
  const { data, error } = await supabase.rpc('submit_app_feedback', {
    p_kind: input.kind,
    p_message: input.message,
    p_page_path: input.pagePath ?? null,
  })

  if (error) {
    logDevError('submitAppFeedback', error)
    throw parsePlayrRpcError(error, "Couldn't send your message.")
  }

  return data
}

export async function submitAppFeedbackDirect(input: {
  kind: FeedbackKind
  message: string
  pagePath?: string | null
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  const trimmed = input.message.trim()
  if (trimmed.length < 3) throw new AppError('Write a little more detail.')

  const { error } = await supabase.from('app_feedback').insert({
    user_id: user.id,
    kind: input.kind,
    message: trimmed,
    page_path: input.pagePath?.trim() || null,
  })

  if (error) {
    logDevError('submitAppFeedbackDirect', error)
    throw new AppError("Couldn't send your message.")
  }
}
