'use client';

import { useState } from 'react';
import WelcomeScreen from '@/components/chatbot/welcome-screen';
import HomeScreen from '@/components/chatbot/home-screen';
import ChatScreen from '@/components/chatbot/chat-screen';
import ChatsScreen from '@/components/chatbot/chats-screen';
import FriendsScreen from '@/components/chatbot/friends-screen';
import SettingsScreen from '@/components/chatbot/settings-screen';

type Screen = 'welcome' | 'home' | 'chat' | 'chats' | 'friends' | 'settings';

interface Conversation {
  id: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
}

interface Chat {
  id: string;
  name: string;
  preview: string;
  timestamp: string;
  unread: number;
  avatar: string;
}

export default function Page() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const handleGoToHome = () => setCurrentScreen('home');
  const handleGoToChat = (conversation?: Conversation) => {
    if (conversation) setSelectedConversation(conversation);
    setCurrentScreen('chat');
  };
  const handleBackToHome = () => setCurrentScreen('home');
  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setCurrentScreen('chat');
  };

  const handleNavigate = (page: string) => {
    setCurrentScreen(page as Screen);
  };

  const handleLogout = () => {
    setCurrentScreen('welcome');
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {currentScreen === 'welcome' && <WelcomeScreen onGetStarted={handleGoToHome} />}
      {currentScreen === 'home' && <HomeScreen onStartChat={handleGoToChat} onNavigate={handleNavigate} />}
      {currentScreen === 'chat' && (
        <ChatScreen conversation={selectedConversation} onBack={handleBackToHome} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'chats' && (
        <ChatsScreen onSelectChat={handleSelectChat} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'friends' && (
        <FriendsScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'settings' && (
        <SettingsScreen onNavigate={handleNavigate} onLogout={handleLogout} />
      )}
    </div>
  );
}
