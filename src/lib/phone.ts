/** Normalize user-entered phone toward E.164 (India default when 10 digits). */
export function normalizePhoneE164(
  input: string,
  defaultCountryCode = '91',
): string | null {
  const raw = input.trim()
  if (!raw) return null

  let digits = raw.replace(/[^\d+]/g, '')
  if (!digits) return null

  if (digits.startsWith('+')) {
    digits = digits.slice(1)
  } else if (digits.length === 10) {
    digits = defaultCountryCode + digits
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null
  return `+${digits}`
}

export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith('+91') || e164.length !== 13) {
    return e164
  }
  const local = e164.slice(3)
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`
}

export function isValidE164(phone: string | null | undefined): boolean {
  if (!phone) return false
  return /^\+[1-9]\d{7,14}$/.test(phone)
}
