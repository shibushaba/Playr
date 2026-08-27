const PREFIX = 'playr-chat-read'

export function getChatLastReadAt(userId: string, gameId: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}:${userId}:${gameId}`)
  } catch {
    return null
  }
}

export function markChatRead(userId: string, gameId: string, at?: string): void {
  try {
    localStorage.setItem(`${PREFIX}:${userId}:${gameId}`, at ?? new Date().toISOString())
  } catch {
    /* ignore quota / private mode */
  }
}

export function hasUnreadChatMessages(
  messages: { createdAt: string; senderId: string }[],
  userId: string,
  gameId: string,
): boolean {
  const lastRead = getChatLastReadAt(userId, gameId)
  const lastReadMs = lastRead ? new Date(lastRead).getTime() : 0
  return messages.some(
    (m) => m.senderId !== userId && new Date(m.createdAt).getTime() > lastReadMs,
  )
}

export function isUnreadChatMessage(
  createdAt: string,
  senderId: string,
  userId: string,
  gameId: string,
): boolean {
  if (senderId === userId) return false
  const lastRead = getChatLastReadAt(userId, gameId)
  if (!lastRead) return true
  return new Date(createdAt).getTime() > new Date(lastRead).getTime()
}
