'use client';

import { useState } from 'react';
import {
  Bell,
  Check,
  Flame,
  Target,
  Sparkles,
  CalendarCheck,
  CheckCheck,
  X,
  Clock,
  Brain,
  Zap,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OfflineNotification } from '@/lib/offline-db';

/* ─── Icon Mapping ─── */

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  'bell': <Bell className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'check': <Check className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'flame': <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'target': <Target className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'sparkles': <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'calendar-check': <CalendarCheck className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'clock': <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'brain': <Brain className="w-3.5 h-3.5" strokeWidth={1.5} />,
  'zap': <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />,
};

const TYPE_COLORS: Record<string, string> = {
  reminder: 'var(--nd-interactive)',
  task: 'var(--nd-success)',
  insight: 'var(--nd-accent)',
  system: 'var(--nd-text-secondary)',
  achievement: '#F7931A',
  streak: '#EA580C',
};

/* ─── Time Formatting ─── */

function formatNotificationTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString();
}

/* ─── Types ─── */

interface NotificationDropdownProps {
  notifications: OfflineNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onNotificationAction?: (notification: OfflineNotification) => void;
}

/* ─── Notification Item (compact for dropdown) ─── */

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
}: {
  notification: OfflineNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: (n: OfflineNotification) => void;
}) {
  const iconNode = NOTIFICATION_ICONS[notification.icon] || NOTIFICATION_ICONS['bell'];
  const typeColor = TYPE_COLORS[notification.type] || 'var(--nd-text-secondary)';

  return (
    <div
      className="group relative flex gap-2.5 px-3 py-2.5 cursor-pointer transition-colors duration-100"
      style={{
        background: notification.read ? 'transparent' : 'rgba(255,255,255,0.03)',
      }}
      onClick={() => {
        if (!notification.read) onMarkAsRead(notification.id);
        onClick?.(notification);
      }}
      onMouseEnter={(e) => {
        if (!notification.read) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
        } else {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = notification.read ? 'transparent' : 'rgba(255,255,255,0.03)';
      }}
    >
      {/* Icon bubble */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: notification.read ? 'var(--nd-border)' : `${typeColor}18`,
          color: notification.read ? 'var(--nd-text-disabled)' : typeColor,
        }}
      >
        {iconNode}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1.5">
          <p
            className="text-xs leading-snug truncate"
            style={{
              color: notification.read ? 'var(--nd-text-secondary)' : 'var(--nd-text-primary)',
              fontWeight: notification.read ? 400 : 600,
            }}
          >
            {notification.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!notification.read && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: typeColor }}
              />
            )}
            <span
              className="font-mono text-[10px]"
              style={{ color: 'var(--nd-text-disabled)' }}
            >
              {formatNotificationTime(notification.createdAt)}
            </span>
          </div>
        </div>
        <p
          className="mt-0.5 text-[11px] leading-snug line-clamp-2"
          style={{ color: 'var(--nd-text-disabled)' }}
        >
          {notification.body}
        </p>
      </div>

      {/* Dismiss button on hover / always visible on touch */}
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 touch-show transition-opacity duration-100 p-0.5 rounded self-center"
        style={{ color: 'var(--nd-text-disabled)' }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        aria-label="Dismiss notification"
      >
        <X className="w-3 h-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ─── Empty State (compact) ─── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'var(--nd-border)', color: 'var(--nd-text-disabled)' }}
      >
        <Bell className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <p
        className="font-mono text-xs mb-0.5"
        style={{ color: 'var(--nd-text-secondary)' }}
      >
        ALL CLEAR
      </p>
      <p
        className="text-[10px] text-center leading-snug"
        style={{ color: 'var(--nd-text-disabled)' }}
      >
        No new notifications
      </p>
    </div>
  );
}

/* ─── Notification Dropdown (Facebook-style) ─── */

export default function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onNotificationAction,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);
  const displayNotifications = activeTab === 'unread' ? unread : notifications;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Trigger: Bell icon with badge */}
      <PopoverTrigger asChild>
        <button
          className="relative rounded-full p-2 transition-colors duration-150"
          style={{ color: open ? 'var(--nd-text-primary)' : 'var(--nd-text-disabled)' }}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="w-5 h-5" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full font-mono"
              style={{
                minWidth: '16px',
                height: '16px',
                fontSize: '9px',
                fontWeight: 700,
                background: 'var(--nd-accent)',
                color: '#fff',
                padding: '0 4px',
                animation: open ? 'none' : 'pulse-dot 2s ease-in-out infinite',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      {/* Dropdown content */}
      <PopoverContent
        align="end"
        sideOffset={12}
        collisionPadding={12}
        avoidCollisions={true}
        className="w-[calc(100vw-24px)] sm:w-[380px] p-0 rounded-xl overflow-hidden border shadow-2xl"
        style={{
          background: 'var(--nd-surface-raised)',
          borderColor: 'var(--nd-border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* ── Arrow indicator pointing to bell ── */}
        <div
          className="absolute -top-1.5 right-4 w-3 h-3 rotate-45"
          style={{
            background: 'var(--nd-surface-raised)',
            borderTop: '1px solid var(--nd-border)',
            borderRight: '1px solid var(--nd-border)',
          }}
        />
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--nd-border)' }}
        >
          <div className="flex items-center gap-2">
            <h3
              className="font-mono uppercase"
              style={{
                fontSize: '12px',
                letterSpacing: '0.08em',
                fontWeight: 700,
                color: 'var(--nd-text-primary)',
              }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span
                className="font-mono px-1.5 py-0.5 rounded-full"
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  background: 'var(--nd-accent)',
                  color: '#fff',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {unreadCount > 0 && (
              <button
                className="p-1.5 rounded-md transition-colors duration-100"
                style={{ color: 'var(--nd-interactive)' }}
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                className="p-1.5 rounded-md transition-colors duration-100"
                style={{ color: 'var(--nd-text-disabled)' }}
                onClick={() => {
                  onClearAll();
                }}
                title="Clear all"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--nd-accent)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
                }}
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        {notifications.length > 0 && (
          <div
            className="flex gap-0.5 px-3 pt-2 pb-1"
          >
            <button
              className="flex-1 font-mono uppercase py-1.5 rounded-md text-[10px] transition-all duration-150"
              style={{
                letterSpacing: '0.06em',
                background: activeTab === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === 'all' ? 'var(--nd-text-primary)' : 'var(--nd-text-disabled)',
              }}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button
              className="flex-1 font-mono uppercase py-1.5 rounded-md text-[10px] transition-all duration-150 relative"
              style={{
                letterSpacing: '0.06em',
                background: activeTab === 'unread' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeTab === 'unread' ? 'var(--nd-text-primary)' : 'var(--nd-text-disabled)',
              }}
              onClick={() => setActiveTab('unread')}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          </div>
        )}

        {/* ── Notification List ── */}
        <ScrollArea className="max-h-[360px]">
          {displayNotifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="py-1">
              {/* Unread section */}
              {activeTab === 'all' && unread.length > 0 && (
                <>
                  <div
                    className="px-3 py-1.5 font-mono uppercase"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    New
                  </div>
                  {unread.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={onMarkAsRead}
                      onDelete={onDeleteNotification}
                      onClick={(n) => {
                        onNotificationAction?.(n);
                        setOpen(false);
                      }}
                    />
                  ))}
                </>
              )}

              {/* Read section */}
              {activeTab === 'all' && read.length > 0 && (
                <>
                  <div
                    className="px-3 py-1.5 font-mono uppercase mt-1"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    Earlier
                  </div>
                  {read.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={onMarkAsRead}
                      onDelete={onDeleteNotification}
                      onClick={(n) => {
                        onNotificationAction?.(n);
                        setOpen(false);
                      }}
                    />
                  ))}
                </>
              )}

              {/* Unread-only list */}
              {activeTab === 'unread' && unread.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={onMarkAsRead}
                  onDelete={onDeleteNotification}
                  onClick={(n) => {
                    onNotificationAction?.(n);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{
              borderTop: '1px solid var(--nd-border)',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <span
              className="font-mono text-[10px]"
              style={{ color: 'var(--nd-text-disabled)' }}
            >
              {notifications.length} total
            </span>
            {unreadCount > 0 && (
              <span
                className="font-mono text-[10px]"
                style={{ color: 'var(--nd-accent)' }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
