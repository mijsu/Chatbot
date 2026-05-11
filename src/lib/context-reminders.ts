const PENDING_REMINDERS_KEY = 'syntra_pending_app_reminders';

export interface AppReminder {
  id: string;
  message: string;
  triggeredAt: string; // ISO date
  screen?: string; // navigate to this screen
}

export function scheduleAppReminder(reminder: AppReminder) {
  const existing = getAppReminders();
  existing.push(reminder);
  localStorage.setItem(PENDING_REMINDERS_KEY, JSON.stringify(existing));
}

export function getAppReminders(): AppReminder[] {
  try {
    const raw = localStorage.getItem(PENDING_REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function clearAppReminder(id: string) {
  const existing = getAppReminders().filter(r => r.id !== id);
  localStorage.setItem(PENDING_REMINDERS_KEY, JSON.stringify(existing));
}

export function clearAllAppReminders() {
  localStorage.removeItem(PENDING_REMINDERS_KEY);
}
