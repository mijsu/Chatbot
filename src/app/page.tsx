'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOfflineConversations } from '@/hooks/use-offline-data';
import { useNotifications, seedWelcomeNotification } from '@/hooks/use-notifications';
import { useInAppNotifications } from '@/hooks/use-in-app-notifications';
import { useCapacitorInit } from '@/hooks/use-capacitor-init';
import { hasPassword } from '@/lib/offline-db';
import { useApiConfig } from '@/lib/api-config';
import { useAIContent } from '@/hooks/use-ai-content';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import WelcomeScreen from '@/components/chatbot/welcome-screen';
import SetupScreen from '@/components/chatbot/setup-screen';
import HomeScreen from '@/components/chatbot/home-screen';
import ChatScreen from '@/components/chatbot/chat-screen';
import ChatsScreen from '@/components/chatbot/chats-screen';
import FriendsScreen from '@/components/chatbot/friends-screen';
import SettingsScreen from '@/components/chatbot/settings-screen';
import PlannerScreen from '@/components/chatbot/planner-screen';
import VoiceModal from '@/components/chatbot/voice-modal';
import BottomNav from '@/components/chatbot/bottom-nav';
import GlobalSearch from '@/components/chatbot/global-search';
import type { OfflineNotification } from '@/lib/offline-db';
import { getAppReminders, clearAppReminder } from '@/lib/context-reminders';

type Screen = 'welcome' | 'setup' | 'home' | 'chat' | 'chats' | 'friends' | 'settings' | 'planner';

interface Conversation {
  id: string;
  title: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
  pinned: boolean;
}

export default function Page() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  // ── AI Content Engine — powers ALL screens with AI-generated text ──
  const aiContent = useAIContent();

  // Notification system (works with both Capacitor native & browser)
  const { permissionStatus, requestPermission, scheduleAll } = useNotifications();

  // In-app notification center
  const {
    notifications: inAppNotifications,
    unreadCount: notificationUnreadCount,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    deleteNotification,
    clearAll: clearAllNotifications,
  } = useInAppNotifications();

  // Initialize Capacitor native features (no-op on web)
  useCapacitorInit();

  // Initialize API config store once at app level
  const initializeApiConfig = useApiConfig((s) => s.initialize);
  useEffect(() => {
    initializeApiConfig();
  }, [initializeApiConfig]);

  // Schedule notifications when authenticated
  const scheduleNotifications = useCallback(async () => {
    if (isAuthenticated) {
      await scheduleAll();
      // Seed a welcome notification if this is a new user
      await seedWelcomeNotification();
    }
  }, [isAuthenticated, scheduleAll]);

  useEffect(() => {
    if (isAuthenticated) {
      scheduleNotifications();
    }
  }, [isAuthenticated, scheduleNotifications]);

  // ── Context-Aware Reminders: Check for pending app reminders on mount ──
  useEffect(() => {
    if (!isAuthenticated) return;
    const pending = getAppReminders();
    if (pending.length > 0) {
      // Show a toast notification
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 9999;
        padding: 12px 20px; border-radius: 999px; font-family: 'Space Mono', monospace;
        font-size: 12px; letter-spacing: 0.04em; color: white;
        background: #EA580C; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: opacity 0.3s ease; white-space: nowrap;
      `;
      toast.textContent = `📌 You have ${pending.length} pending reminder${pending.length > 1 ? 's' : ''}`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3500);

      // Navigate to the appropriate screen for the first reminder
      const first = pending[0];
      if (first.screen) {
        setCurrentScreen(first.screen as Screen);
      }

      // Clear all shown reminders
      for (const r of pending) {
        clearAppReminder(r.id);
      }
    }
  }, [isAuthenticated]);

  // Check on mount if a password is set — if not, go to setup for first-time users
  useEffect(() => {
    (async () => {
      const needsPassword = await hasPassword();
      if (!needsPassword) {
        setIsAuthenticated(true);
        // Check if user has already set up (has role in settings)
        try {
          const { db } = await import('@/lib/offline-db');
          const settings = await db.settings.get('default');
          if (settings?.role && settings.role.length > 0) {
            setCurrentScreen('home');
          } else {
            setCurrentScreen('setup');
          }
        } catch {
          setCurrentScreen('setup');
        }
      }
      setAuthChecked(true);
    })();
  }, []);

  const handleGoToHome = () => {
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };
  const handleGoToSetup = () => {
    setIsAuthenticated(true);
    setCurrentScreen('setup');
  };
  const handleSetupFinish = () => {
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };
  const handleSetupSkip = () => {
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };
  const { addConversation } = useOfflineConversations();

  const handleGoToChat = async (conversation?: Conversation, message?: string) => {
    if (conversation) {
      setSelectedConversation(conversation);
      setInitialMessage(message);
      setCurrentScreen('chat');
    } else {
      try {
        const newConv = await addConversation({ title: 'New Chat', botName: 'Syntra', icon: 'bot', pinned: false });
        if (newConv) {
          setSelectedConversation({
            id: newConv.id,
            title: newConv.title,
            botName: newConv.botName,
            preview: '',
            time: 'Just now',
            icon: newConv.icon,
            pinned: false,
          });
          setInitialMessage(message);
          setCurrentScreen('chat');
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    }
  };
  const handleBackToHome = () => setCurrentScreen('home');
  const handleNavigate = (page: string) => {
    setCurrentScreen(page as Screen);
  };
  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentScreen('welcome');
  };
  const handleNewChat = async () => {
    try {
      const newConv = await addConversation({ title: 'New Chat', botName: 'Syntra', icon: 'bot', pinned: false });
      if (newConv) {
        setSelectedConversation({
          id: newConv.id,
          title: newConv.title,
          botName: newConv.botName,
          preview: '',
          time: 'Just now',
          icon: newConv.icon,
          pinned: false,
        });
        setCurrentScreen('chat');
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleOpenVoiceModal = () => {
    setIsVoiceModalOpen(true);
  };

  const handleCloseVoiceModal = () => {
    setIsVoiceModalOpen(false);
  };

  // ── Global Search: Cmd/Ctrl+K shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleCloseGlobalSearch = useCallback(() => {
    setIsGlobalSearchOpen(false);
  }, []);

  const handleNotificationAction = (notification: OfflineNotification) => {
    if (notification.actionType === 'navigate' && notification.actionData) {
      try {
        const data = JSON.parse(notification.actionData);
        if (data.screen) {
          setCurrentScreen(data.screen as Screen);
        }
      } catch { /* ignore */ }
    } else if (notification.actionType === 'chat' && notification.actionData) {
      try {
        const data = JSON.parse(notification.actionData);
        if (data.conversationId) {
          const conv = {
            id: data.conversationId,
            title: data.title || 'Chat',
            botName: data.botName || 'Syntra',
            preview: '',
            time: 'Just now',
            icon: data.icon || 'bot',
            pinned: false,
          };
          setSelectedConversation(conv);
          setCurrentScreen('chat');
        }
      } catch { /* ignore */ }
    }
  };

  // Determine active screen for bottom nav
  const getActiveScreen = (): 'home' | 'planner' | 'chats' | 'friends' | 'settings' => {
    switch (currentScreen) {
      case 'home': return 'home';
      case 'planner': return 'planner';
      case 'chats': return 'chats';
      case 'chat': return 'chats';
      case 'friends': return 'friends';
      case 'settings': return 'settings';
      default: return 'home';
    }
  };

  // Whether to show bottom nav
  const showBottomNav = isAuthenticated && !['welcome', 'setup'].includes(currentScreen);

  // Detect desktop layout (lg breakpoint = 1024px) to avoid mounting
  // duplicate screen components in both desktop and mobile containers.
  // CSS `hidden`/`display:none` only hides visually — React still mounts
  // the components, causing duplicate effects (e.g. double API calls).
  const isDesktop = useIsDesktop();

  const renderScreen = (screen: Screen) => {
    switch (screen) {
      case 'welcome':
        return <WelcomeScreen onGetStarted={handleGoToHome} onGoToSetup={handleGoToSetup} />;
      case 'setup':
        return <SetupScreen onFinish={handleSetupFinish} onSkip={handleSetupSkip} />;
      case 'home':
        return (
          <HomeScreen
            onStartChat={handleGoToChat}
            onNavigate={handleNavigate}
            onOpenVoiceModal={handleOpenVoiceModal}
            aiContent={aiContent}
            notifications={inAppNotifications}
            notificationUnreadCount={notificationUnreadCount}
            onMarkNotificationAsRead={markNotificationAsRead}
            onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
            onDeleteNotification={deleteNotification}
            onClearAllNotifications={clearAllNotifications}
            onNotificationAction={handleNotificationAction}
          />
        );
      case 'chat':
        return (
          <ChatScreen
            conversation={selectedConversation}
            onBack={handleBackToHome}
            onNavigate={handleNavigate}
            onNewChat={handleNewChat}
            onOpenVoiceModal={handleOpenVoiceModal}
            initialMessage={initialMessage}
            onInitialMessageSent={() => setInitialMessage(undefined)}
          />
        );
      case 'chats':
        return (
          <ChatsScreen
            onSelectChat={(chat) => {
              setSelectedConversation(chat);
              setCurrentScreen('chat');
            }}
            onNavigate={handleNavigate}
            onOpenVoiceModal={handleOpenVoiceModal}
          />
        );
      case 'planner':
        return (
          <PlannerScreen
            onNavigate={handleNavigate}
            onOpenVoiceModal={handleOpenVoiceModal}
            aiContent={aiContent}
          />
        );
      case 'friends':
        return (
          <FriendsScreen
            onNavigate={handleNavigate}
            onOpenVoiceModal={handleOpenVoiceModal}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onOpenVoiceModal={handleOpenVoiceModal}
            notificationPermission={permissionStatus}
            onRequestNotificationPermission={requestPermission}
            aiContent={aiContent}
          />
        );
      default:
        return <WelcomeScreen onGetStarted={handleGoToHome} onGoToSetup={handleGoToSetup} />;
    }
  };

  // Don't render anything until the initial auth check completes
  // This prevents a flash of the welcome screen before redirecting
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--nd-black)' }}>
        <div className="animate-pulse" style={{ color: 'var(--nd-text-disabled)' }}>
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--nd-black)' }}>
      <main className="flex-1 flex">
        {isDesktop ? (
          /* Desktop: Sidebar + Main Content */
          <div className="flex w-full h-screen">
            {/* Sidebar - show on all screens except welcome */}
            {currentScreen !== 'welcome' && (
              <div
                className="w-80 flex flex-col border-r"
                style={{
                  background: 'var(--nd-surface)',
                  borderColor: 'var(--nd-border)',
                }}
              >
                <ChatsScreen
                  onSelectChat={(chat) => {
                    setSelectedConversation(chat);
                    setCurrentScreen('chat');
                  }}
                  onNavigate={handleNavigate}
                  onOpenVoiceModal={handleOpenVoiceModal}
                />
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 h-full overflow-hidden flex flex-col">
              <div className="flex-1 overflow-hidden">
                {renderScreen(currentScreen)}
              </div>
            </div>
          </div>
        ) : (
          /* Mobile: Single screen with bottom nav */
          <div className="w-full h-screen flex flex-col">
            <div className="flex-1 overflow-hidden">
              {renderScreen(currentScreen)}
            </div>
            {showBottomNav && (
              <BottomNav
                active={getActiveScreen()}
                onNavigate={handleNavigate}
                onVoiceOpen={handleOpenVoiceModal}
                navLabels={aiContent.nav}
              />
            )}
          </div>
        )}
      </main>

      {/* Voice Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={handleCloseVoiceModal}
        onSendMessage={(message) => {
          // If already on the chat screen with a conversation, send to it directly
          if (currentScreen === 'chat' && selectedConversation) {
            setInitialMessage(message);
          } else {
            handleGoToChat(undefined, message);
          }
        }}
      />

      {/* Global Search */}
      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        onClose={handleCloseGlobalSearch}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
