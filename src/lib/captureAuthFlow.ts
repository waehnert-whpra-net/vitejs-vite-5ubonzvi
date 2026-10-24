// Muss in main.tsx als ERSTER Import stehen – noch bevor der Supabase-Client
// das URL-Fragment (#access_token=…&type=invite) auswertet und entfernt.
//
// Merkt sich, dass der Nutzer über einen Einladungs- oder Recovery-Link
// gekommen ist und noch ein Passwort setzen muss. Dadurch landet er auf der
// Passwort-Seite, egal auf welcher URL ihn der Link ankommen lässt.

const FLAG = 'flox_set_password'

try {
  const hash = window.location.hash
  if (hash.includes('type=invite') || hash.includes('type=recovery')) {
    sessionStorage.setItem(FLAG, '1')
  }
} catch {
  // sessionStorage nicht verfügbar – dann greift nur die Route /reset-password
}

export function needsSetPassword(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

export function clearSetPasswordFlag(): void {
  try {
    sessionStorage.removeItem(FLAG)
  } catch {
    // ignorieren
  }
}
