'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  db,
  generateId,
  initializeDefaults,
  type OfflineConversationMemory,
  type OfflineGlobalMemory,
  type OfflineInsightLog,
  type OfflineContextCache,
} from '@/lib/offline-db';

/* ═══════════════════════════════════════════════════════════════════
   Generic data loader hook pattern
   ═══════════════════════════════════════════════════════════════════ */

function useAsyncData<T>(loader: () => Promise<T>, initialValue: T, deps: React.DependencyList) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loader();
      if (mountedRef.current) setData(result);
    } catch {
      if (mountedRef.current) setData(initialValue);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, setData, loading, load };
}

/* ═══════════════════════════════════════════════════════════════════
   CONVERSATION MEMORIES
   Summaries, key decisions, preferences, entities per conversation
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineConversationMemories(conversationId?: string) {
  const { data: memories, load: reloadMemories } = useAsyncData<OfflineConversationMemory[]>(
    async () => {
      if (!conversationId) return [];
      return await db.conversationMemories
        .where('conversationId')
        .equals(conversationId)
        .sortBy('timestamp');
    },
    [],
    [conversationId]
  );

  const addMemory = useCallback(async (memory: Omit<OfflineConversationMemory, 'id'>) => {
    const newMemory: OfflineConversationMemory = { ...memory, id: generateId() };
    await db.conversationMemories.add(newMemory);
    await reloadMemories();
    return newMemory;
  }, [reloadMemories]);

  const addSummary = useCallback(async (conversationId: string, content: string, importance: OfflineConversationMemory['importance'] = 'medium') => {
    return addMemory({
      conversationId,
      type: 'summary',
      content,
      timestamp: new Date(),
      importance,
    });
  }, [addMemory]);

  const addKeyDecision = useCallback(async (conversationId: string, content: string) => {
    return addMemory({
      conversationId,
      type: 'keyDecision',
      content,
      timestamp: new Date(),
      importance: 'high',
    });
  }, [addMemory]);

  const addPreference = useCallback(async (conversationId: string, content: string) => {
    return addMemory({
      conversationId,
      type: 'preference',
      content,
      timestamp: new Date(),
      importance: 'medium',
    });
  }, [addMemory]);

  const addEntity = useCallback(async (conversationId: string, content: string) => {
    return addMemory({
      conversationId,
      type: 'entity',
      content,
      timestamp: new Date(),
      importance: 'low',
    });
  }, [addMemory]);

  const getSummariesForConversation = useCallback(async (convId: string): Promise<OfflineConversationMemory[]> => {
    return await db.conversationMemories
      .where('conversationId')
      .equals(convId)
      .filter(m => m.type === 'summary')
      .sortBy('timestamp');
  }, []);

  const deleteMemoriesForConversation = useCallback(async (convId: string) => {
    await db.conversationMemories.where('conversationId').equals(convId).delete();
    await reloadMemories();
  }, [reloadMemories]);

  return {
    memories,
    addMemory,
    addSummary,
    addKeyDecision,
    addPreference,
    addEntity,
    getSummariesForConversation,
    deleteMemoriesForConversation,
    reload: reloadMemories,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL MEMORIES
   Cross-conversation knowledge: preferences, facts, goals, relationships, insights
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineGlobalMemories() {
  const { data: globalMemories, load: reloadGlobalMemories } = useAsyncData<OfflineGlobalMemory[]>(
    async () => {
      const result = await db.globalMemories.toArray();
      result.sort((a, b) => new Date(b.lastMentioned).getTime() - new Date(a.lastMentioned).getTime());
      return result;
    },
    [],
    []
  );

  const addGlobalMemory = useCallback(async (memory: Omit<OfflineGlobalMemory, 'id'>) => {
    const newMemory: OfflineGlobalMemory = { ...memory, id: generateId() };
    await db.globalMemories.add(newMemory);
    await reloadGlobalMemories();
    return newMemory;
  }, [reloadGlobalMemories]);

  const upsertGlobalMemory = useCallback(async (
    key: string,
    category: OfflineGlobalMemory['category'],
    value: string,
    sourceConversationId: string
  ) => {
    // Check if memory with this key already exists
    const existing = await db.globalMemories.where('key').equals(key).toArray();

    if (existing.length > 0) {
      // Update existing — increase confidence
      const mem = existing[0];
      await db.globalMemories.update(mem.id, {
        value,
        sourceConversationId,
        confidence: Math.min(1, mem.confidence + 0.2),
        lastMentioned: new Date(),
        timesConfirmed: mem.timesConfirmed + 1,
      });
    } else {
      // Create new
      await db.globalMemories.add({
        id: generateId(),
        category,
        key,
        value,
        sourceConversationId,
        confidence: 0.5,
        lastMentioned: new Date(),
        timesConfirmed: 1,
      });
    }
    await reloadGlobalMemories();
  }, [reloadGlobalMemories]);

  const searchMemories = useCallback(async (query: string, limit: number = 10): Promise<OfflineGlobalMemory[]> => {
    const all = await db.globalMemories.toArray();
    const lowerQuery = query.toLowerCase();
    // Simple keyword-based search (no embeddings for now)
    const scored = all.map(mem => {
      const keyMatch = mem.key.toLowerCase().includes(lowerQuery) ? 2 : 0;
      const valueMatch = mem.value.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const categoryMatch = mem.category.toLowerCase().includes(lowerQuery) ? 0.5 : 0;
      const score = (keyMatch + valueMatch + categoryMatch) * mem.confidence;
      return { mem, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.mem);
  }, []);

  const getMemoriesByCategory = useCallback(async (category: OfflineGlobalMemory['category']): Promise<OfflineGlobalMemory[]> => {
    return await db.globalMemories.where('category').equals(category).toArray();
  }, []);

  const deleteGlobalMemory = useCallback(async (id: string) => {
    await db.globalMemories.delete(id);
    await reloadGlobalMemories();
  }, [reloadGlobalMemories]);

  const clearAllGlobalMemories = useCallback(async () => {
    await db.globalMemories.clear();
    await reloadGlobalMemories();
  }, [reloadGlobalMemories]);

  return {
    globalMemories,
    addGlobalMemory,
    upsertGlobalMemory,
    searchMemories,
    getMemoriesByCategory,
    deleteGlobalMemory,
    clearAllGlobalMemories,
    reload: reloadGlobalMemories,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   INSIGHT LOG
   AI-generated proactive insights (warnings, suggestions, celebrations, questions)
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineInsightLog() {
  const { data: insights, load: reloadInsights } = useAsyncData<OfflineInsightLog[]>(
    async () => {
      const result = await db.insightLog.toArray();
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return result;
    },
    [],
    []
  );

  const addInsight = useCallback(async (insight: Omit<OfflineInsightLog, 'id'>) => {
    const newInsight: OfflineInsightLog = { ...insight, id: generateId() };
    await db.insightLog.add(newInsight);
    await reloadInsights();
    return newInsight;
  }, [reloadInsights]);

  const dismissInsight = useCallback(async (id: string) => {
    await db.insightLog.update(id, { dismissed: true });
    await reloadInsights();
  }, [reloadInsights]);

  const clearDismissedInsights = useCallback(async () => {
    const allInsights = await db.insightLog.toArray();
    const dismissedIds = allInsights.filter(i => i.dismissed).map(i => i.id);
    await db.insightLog.bulkDelete(dismissedIds);
    await reloadInsights();
  }, [reloadInsights]);

  const clearAllInsights = useCallback(async () => {
    await db.insightLog.clear();
    await reloadInsights();
  }, [reloadInsights]);

  return {
    insights,
    activeInsights: insights.filter(i => !i.dismissed),
    addInsight,
    dismissInsight,
    clearDismissedInsights,
    clearAllInsights,
    reload: reloadInsights,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   CONTEXT CACHE
   Cached unified context with TTL-based expiration
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineContextCache() {
  const getCachedContext = useCallback(async (key: string): Promise<string | null> => {
    const cached = await db.contextCache.get(key);
    if (!cached) return null;
    const age = Date.now() - new Date(cached.generatedAt).getTime();
    if (age > cached.ttl) {
      await db.contextCache.delete(key);
      return null;
    }
    return cached.data;
  }, []);

  const setCachedContext = useCallback(async (key: string, data: string, ttlMs: number = 60000) => {
    await db.contextCache.put({
      id: key,
      data,
      generatedAt: new Date(),
      ttl: ttlMs,
    });
  }, []);

  const invalidateCache = useCallback(async (key?: string) => {
    if (key) {
      await db.contextCache.delete(key);
    } else {
      await db.contextCache.clear();
    }
  }, []);

  return {
    getCachedContext,
    setCachedContext,
    invalidateCache,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   DIRECT DB ACCESS (for server-side or non-hook usage)
   ═══════════════════════════════════════════════════════════════════ */

export async function getAllConversationMemories(conversationId: string): Promise<OfflineConversationMemory[]> {
  return await db.conversationMemories
    .where('conversationId')
    .equals(conversationId)
    .sortBy('timestamp');
}

export async function getRecentConversationSummaries(limit: number = 5): Promise<OfflineConversationMemory[]> {
  const all = await db.conversationMemories
    .where('type')
    .equals('summary')
    .toArray();
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return all.slice(0, limit);
}

export async function getAllGlobalMemories(): Promise<OfflineGlobalMemory[]> {
  return await db.globalMemories.toArray();
}

export async function getHighConfidenceGlobalMemories(minConfidence: number = 0.7): Promise<OfflineGlobalMemory[]> {
  const all = await db.globalMemories.toArray();
  return all.filter(m => m.confidence >= minConfidence).sort((a, b) => b.confidence - a.confidence);
}

export async function addConversationMemory(memory: Omit<OfflineConversationMemory, 'id'>): Promise<OfflineConversationMemory> {
  const newMemory: OfflineConversationMemory = { ...memory, id: generateId() };
  await db.conversationMemories.add(newMemory);
  return newMemory;
}

export async function upsertGlobalMemory(
  key: string,
  category: OfflineGlobalMemory['category'],
  value: string,
  sourceConversationId: string
): Promise<void> {
  const existing = await db.globalMemories.where('key').equals(key).toArray();
  if (existing.length > 0) {
    const mem = existing[0];
    await db.globalMemories.update(mem.id, {
      value,
      sourceConversationId,
      confidence: Math.min(1, mem.confidence + 0.2),
      lastMentioned: new Date(),
      timesConfirmed: mem.timesConfirmed + 1,
    });
  } else {
    await db.globalMemories.add({
      id: generateId(),
      category,
      key,
      value,
      sourceConversationId,
      confidence: 0.5,
      lastMentioned: new Date(),
      timesConfirmed: 1,
    });
  }
}

export async function addInsightToLog(insight: Omit<OfflineInsightLog, 'id'>): Promise<OfflineInsightLog> {
  const newInsight: OfflineInsightLog = { ...insight, id: generateId() };
  await db.insightLog.add(newInsight);
  return newInsight;
}

export async function clearAllMemoryData(): Promise<void> {
  await db.conversationMemories.clear();
  await db.globalMemories.clear();
  await db.insightLog.clear();
  await db.contextCache.clear();
}
