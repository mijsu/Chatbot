import { db } from './offline-db';

export async function exportAllData(): Promise<string> {
  const data = {
    version: 10,
    exportedAt: new Date().toISOString(),
    tasks: await db.tasks.toArray(),
    reminders: await db.reminders.toArray(),
    conversations: await db.conversations.toArray(),
    messages: await db.messages.toArray(),
    profile: await db.profile.toArray(),
    settings: await db.settings.toArray(),
    goals: await db.goals.toArray(),
    habits: await db.habits.toArray(),
    moods: await db.moods.toArray(),
    notifications: await db.notifications.toArray(),
    conversationMemories: await db.conversationMemories?.toArray() ?? [],
    globalMemories: await db.globalMemories?.toArray() ?? [],
    insightLog: await db.insightLog?.toArray() ?? [],
    contextCache: await db.contextCache?.toArray() ?? [],
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.tasks) {
      return { success: false, message: 'Invalid backup file format' };
    }

    // Clear existing data
    await db.tasks.clear();
    await db.reminders.clear();
    await db.conversations.clear();
    await db.messages.clear();
    await db.goals.clear();
    await db.habits.clear();
    await db.moods.clear();
    await db.notifications.clear();
    if (db.conversationMemories) await db.conversationMemories.clear();
    if (db.globalMemories) await db.globalMemories.clear();
    if (db.insightLog) await db.insightLog.clear();
    if (db.contextCache) await db.contextCache.clear();

    // Import data
    if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks);
    if (data.reminders?.length) await db.reminders.bulkAdd(data.reminders);
    if (data.conversations?.length) await db.conversations.bulkAdd(data.conversations);
    if (data.messages?.length) await db.messages.bulkAdd(data.messages);
    if (data.goals?.length) await db.goals.bulkAdd(data.goals);
    if (data.habits?.length) await db.habits.bulkAdd(data.habits);
    if (data.moods?.length) await db.moods.bulkAdd(data.moods);
    if (data.notifications?.length) await db.notifications.bulkAdd(data.notifications);
    if (data.conversationMemories?.length && db.conversationMemories) await db.conversationMemories.bulkAdd(data.conversationMemories);
    if (data.globalMemories?.length && db.globalMemories) await db.globalMemories.bulkAdd(data.globalMemories);
    if (data.insightLog?.length && db.insightLog) await db.insightLog.bulkAdd(data.insightLog);
    if (data.contextCache?.length && db.contextCache) await db.contextCache.bulkAdd(data.contextCache);

    // Update profile and settings (single records)
    if (data.profile?.length) {
      await db.profile.clear();
      await db.profile.bulkAdd(data.profile);
    }
    if (data.settings?.length) {
      await db.settings.clear();
      await db.settings.bulkAdd(data.settings);
    }

    return { success: true, message: `Restored ${data.tasks.length} tasks, ${data.reminders.length} reminders, ${data.goals.length} goals` };
  } catch (err) {
    return { success: false, message: 'Failed to parse backup file' };
  }
}
