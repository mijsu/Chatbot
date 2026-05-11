'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Trash2,
  Pin,
  Pencil,
  Plus,
  Brain,
  Sparkles,
  Palette,
  MessageCircle,
  Mic,
} from 'lucide-react';
import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';
import ConfirmDialog from '@/components/chatbot/confirm-dialog';
import { useOfflineConversations } from '@/hooks/use-offline-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/* ─── Types ─── */

interface Conversation {
  id: string;
  title: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
  pinned: boolean;
}

/* ─── Relative time formatter ─── */

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

interface ChatsScreenProps {
  onSelectChat: (chat: Conversation) => void;
  onNavigate: (page: string) => void;
  onOpenVoiceModal?: () => void;
}

/* ─── Icon map — monoline, no fill ─── */

const botIcons: Record<string, React.ReactNode> = {
  brain: <Brain className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  palette: <Palette className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  sparkles: <Sparkles className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  zap: <DotmTriangle11 size={20} dotSize={3} speed={1.2} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />,
  bot: <DotmTriangle11 size={20} dotSize={3} speed={1.2} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />,
};

/* ─── ChatsScreen ─── */

export default function ChatsScreen({ onSelectChat, onNavigate, onOpenVoiceModal }: ChatsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    conversations: offlineConversations,
    loading,
    addConversation,
    updateConversation,
    deleteConversation: deleteConversationHook,
    getConversationPreview,
  } = useOfflineConversations();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // Load previews asynchronously
  useEffect(() => {
    let cancelled = false;
    async function loadPreviews() {
      const newPreviews: Record<string, string> = {};
      for (const conv of offlineConversations) {
        newPreviews[conv.id] = await getConversationPreview(conv.id);
      }
      if (!cancelled) setPreviews(newPreviews);
    }
    loadPreviews();
    return () => { cancelled = true; };
  }, [offlineConversations, getConversationPreview]);

  // Map OfflineConversation → Conversation for UI
  const conversations: Conversation[] = offlineConversations.map((c) => ({
    id: c.id,
    title: c.title,
    botName: c.botName,
    preview: previews[c.id] || '',
    time: formatRelativeTime(c.updatedAt),
    icon: c.icon,
    pinned: c.pinned,
  }));

  const filteredChats = conversations.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.preview && chat.preview.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinnedChats = filteredChats.filter((c) => c.pinned);
  const regularChats = filteredChats.filter((c) => !c.pinned);

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversationHook(id);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handlePinConversation = async (id: string) => {
    const conv = offlineConversations.find((c) => c.id === id);
    if (!conv) return;
    try {
      await updateConversation(id, { pinned: !conv.pinned });
      setOpenMenuId(null);
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  const openRenameDialog = (id: string) => {
    const conv = offlineConversations.find((c) => c.id === id);
    if (!conv) return;
    setRenameTarget(id);
    setRenameValue(conv.title);
    setOpenMenuId(null);
  };

  const handleRenameSave = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenameSaving(true);
    try {
      await updateConversation(renameTarget, { title: renameValue.trim() });
    } catch (error) {
      console.error('Failed to rename:', error);
    } finally {
      setRenameSaving(false);
      setRenameTarget(null);
      setRenameValue('');
    }
  };

  const handleNewChat = async () => {
    try {
      const newConv = await addConversation({ title: 'New Chat', botName: 'Syntra', icon: 'bot', pinned: false });
      onSelectChat({
        id: newConv.id,
        title: newConv.title,
        botName: newConv.botName,
        preview: '',
        time: 'Just now',
        icon: newConv.icon,
        pinned: false,
      });
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--nd-black)' }}>
      {/* ═══ Header Section ═══ */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4">
        {/* Top row: Title + Plus button */}
        <div className="flex justify-between items-center mb-5">
          <h1
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--nd-text-display)',
            }}
          >
            Messages
          </h1>
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              backgroundColor: 'transparent',
              border: '1px solid var(--nd-border-visible)',
              color: 'var(--nd-text-display)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
            }}
            aria-label="New chat"
          >
            <Plus className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Search Bar — underline style, Space Mono */}
        <div className="relative">
          <Search
            className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4"
            strokeWidth={1.5}
            style={{ color: 'var(--nd-text-disabled)' }}
          />
          <input
            type="text"
            placeholder="SEARCH CHATS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pb-2 text-sm focus:outline-none"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '13px',
              letterSpacing: '0.04em',
              color: 'var(--nd-text-primary)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--nd-border-visible)',
              borderRadius: '0',
            }}
          />
        </div>
      </div>

      {/* ═══ Chat List ═══ */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-16 scrollbar-thin">
        {loading ? (
          /* Loading — skeleton rows */
          <div className="flex flex-col gap-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <ChatItemSkeleton key={i} />
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          /* Empty state — MessageCircle icon #333333, headline #999999, description #666666 */
          <div className="flex flex-col items-center justify-center py-16 text-center nd-fade-in">
            <MessageCircle
              className="w-12 h-12 mb-4"
              strokeWidth={1.5}
              style={{ color: 'var(--nd-border-visible)' }}
            />
            <p
              className="font-medium text-base mb-1"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              {searchQuery ? 'No chats found' : 'No conversations yet'}
            </p>
            <p
              className="text-sm"
              style={{ color: 'var(--nd-text-disabled)' }}
            >
              {searchQuery ? 'Try a different search term' : 'Start a new chat to begin'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleNewChat}
                className="nd-btn-primary mt-6"
              >
                New Chat
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Pinned Chats */}
            {pinnedChats.length > 0 && (
              <div className="mb-4">
                <h2
                  className="px-0 mb-2"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--nd-text-disabled)',
                  }}
                >
                  Pinned
                </h2>
                <div>
                  {pinnedChats.map((chat, index) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      onSelect={onSelectChat}
                      onDelete={handleDeleteConversation}
                      onPin={handlePinConversation}
                      onRename={openRenameDialog}
                      onRequestDelete={(id) => { setDeleteTarget(id); }}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      showDivider={index < pinnedChats.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Chats */}
            {regularChats.length > 0 && (
              <div>
                {pinnedChats.length > 0 && (
                  <h2
                    className="px-0 mb-2"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: '11px',
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    Recent
                  </h2>
                )}
                <div>
                  {regularChats.map((chat, index) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      onSelect={onSelectChat}
                      onDelete={handleDeleteConversation}
                      onPin={handlePinConversation}
                      onRename={openRenameDialog}
                      onRequestDelete={(id) => { setDeleteTarget(id); }}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      showDivider={index < regularChats.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Conversation?"
        description="This action cannot be undone. All messages in this conversation will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        icon="delete"
        onConfirm={() => {
          if (deleteTarget) {
            handleDeleteConversation(deleteTarget);
          }
          setDeleteTarget(null);
        }}
      />

      {/* ── Rename Conversation Dialog ── */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameValue('');
          }
        }}
      >
        <DialogContent
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-mono uppercase"
              style={{ color: 'var(--nd-text-display)', fontSize: '13px', letterSpacing: '0.06em' }}
            >
              Rename Conversation
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)', fontSize: '12px' }}>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); }}
            placeholder="Conversation name"
            autoFocus
            style={{
              backgroundColor: 'var(--nd-black)',
              border: '1px solid var(--nd-border-visible)',
              borderRadius: '8px',
              color: 'var(--nd-text-display)',
            }}
          />
          <DialogFooter className="gap-2">
            <button
              onClick={() => { setRenameTarget(null); setRenameValue(''); }}
              className="font-mono uppercase px-4 py-2 rounded-full text-xs"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-secondary)',
                border: '1px solid var(--nd-border-visible)',
                letterSpacing: '0.06em',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRenameSave}
              disabled={renameSaving || !renameValue.trim()}
              className="font-mono uppercase px-4 py-2 rounded-full text-xs"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                border: 'none',
                letterSpacing: '0.06em',
                opacity: renameSaving || !renameValue.trim() ? 0.5 : 1,
              }}
            >
              {renameSaving ? 'Saving...' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Floating Voice Button ── */}
      {onOpenVoiceModal && (
        <button
          onClick={onOpenVoiceModal}
          className="absolute bottom-4 right-4 flex items-center justify-center z-20 sm:bottom-5 sm:right-5"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '999px',
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            cursor: 'pointer',
            transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
            e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
            e.currentTarget.style.backgroundColor = 'var(--nd-surface)';
          }}
          aria-label="Voice input"
        >
          <Mic className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />
        </button>
      )}
    </div>
  );
}

/* ─── ChatItem Sub-Component ─── */

function ChatItem({
  chat,
  onSelect,
  onDelete,
  onPin,
  onRename,
  onRequestDelete,
  openMenuId,
  setOpenMenuId,
  showDivider,
}: {
  chat: Conversation;
  onSelect: (chat: Conversation) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string) => void;
  onRequestDelete: (id: string) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  showDivider: boolean;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => onSelect(chat)}
        className="w-full py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 cursor-pointer group text-left bg-transparent border-none p-0 overflow-hidden"
        style={{
          backgroundColor: 'transparent',
          borderBottom: showDivider ? '1px solid var(--nd-border)' : 'none',
          font: 'inherit',
          color: 'inherit',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--nd-surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* ── Left: Avatar + Text (shrinks to fit) ── */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          {/* Avatar — fixed size, never shrinks */}
          <div
            className="flex items-center justify-center flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11"
            style={{
              borderRadius: '999px',
              backgroundColor: 'var(--nd-surface)',
              border: '1px solid var(--nd-border-visible)',
            }}
          >
            {botIcons[chat.icon] || <DotmTriangle11 size={20} dotSize={3} speed={1.2} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />}
          </div>
          {/* Text block — absorbs all available space, clips overflow */}
          <div className="flex-1 text-left min-w-0 overflow-hidden">
            {/* Title row — truncates with ellipsis */}
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <p
                className="font-medium text-sm truncate"
                style={{ color: 'var(--nd-text-display)' }}
              >
                {chat.title}
              </p>
              {chat.pinned && (
                <Pin
                  className="w-3 h-3 flex-shrink-0"
                  strokeWidth={1.5}
                  style={{ color: 'var(--nd-text-disabled)' }}
                />
              )}
            </div>
            {/* Preview — single line clamp */}
            <p
              className="text-xs line-clamp-1 mt-0.5"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              {chat.preview}
            </p>
          </div>
        </div>

        {/* ── Right: Timestamp + Menu (always visible, never shrinks) ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0 pl-2 sm:pl-3">
          <span
            className="text-xs whitespace-nowrap"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '11px',
              color: 'var(--nd-text-disabled)',
            }}
          >
            {chat.time}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === chat.id ? null : chat.id);
            }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 touch-show flex-shrink-0"
            style={{
              color: 'var(--nd-text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--nd-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--nd-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </button>

      {/* Context Menu — #1A1A1A bg, 1px solid #333333 border, 8px radius, no shadow */}
      {openMenuId === chat.id && (
        <div
          className="absolute right-3 bottom-full mb-1 overflow-hidden z-30 w-40"
          style={{
            backgroundColor: 'var(--nd-surface-raised)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '8px',
          }}
        >
          <button
            onClick={() => onPin(chat.id)}
            className="w-full text-left px-4 py-3 flex items-center gap-2.5 text-sm font-medium"
            style={{
              color: 'var(--nd-text-primary)',
              borderBottom: '1px solid var(--nd-border)',
              background: 'transparent',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--nd-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Pin className="w-4 h-4" strokeWidth={1.5} />
            {chat.pinned ? 'Unpin' : 'Pin Chat'}
          </button>
          <button
            onClick={() => { setOpenMenuId(null); onRename(chat.id); }}
            className="w-full text-left px-4 py-3 flex items-center gap-2.5 text-sm font-medium"
            style={{
              color: 'var(--nd-text-primary)',
              borderBottom: '1px solid var(--nd-border)',
              background: 'transparent',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--nd-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Pencil className="w-4 h-4" strokeWidth={1.5} />
            Rename
          </button>
          <button
            onClick={() => { setOpenMenuId(null); onRequestDelete(chat.id); }}
            className="w-full text-left px-4 py-3 flex items-center gap-2.5 text-sm font-medium"
            style={{
              color: 'var(--nd-accent)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--nd-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── ChatItemSkeleton — mimics ChatItem layout with nd-skeleton ─── */

function ChatItemSkeleton() {
  return (
    <div className="w-full py-3 flex items-center gap-3">
      {/* Avatar placeholder */}
      <div
        className="flex-shrink-0 nd-skeleton"
        style={{ width: '44px', height: '44px', borderRadius: '999px' }}
      />
      {/* Text lines */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="nd-skeleton" style={{ width: '60%', height: '14px', borderRadius: '4px' }} />
        <div className="nd-skeleton" style={{ width: '85%', height: '12px', borderRadius: '4px' }} />
      </div>
      {/* Timestamp placeholder */}
      <div className="flex-shrink-0 nd-skeleton" style={{ width: '32px', height: '11px', borderRadius: '4px' }} />
    </div>
  );
}
