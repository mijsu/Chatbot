'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Image, Users, Settings, Home, Send, Menu, MessageSquare, Zap, Sparkles, Brain, Palette, X } from 'lucide-react';

interface Conversation {
  id: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
}

interface HomeScreenProps {
  onStartChat: (conversation?: Conversation) => void;
  onNavigate?: (page: string) => void;
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    botName: 'ChatGPT',
    preview: 'Best 2023 mobile app suggestion...',
    time: '22:10',
    icon: 'brain',
  },
  {
    id: '2',
    botName: 'Midjourney',
    preview: 'Looking for dark UI design ideas.',
    time: '11:23',
    icon: 'palette',
  },
  {
    id: '3',
    botName: 'Google AI',
    preview: 'Show AI-inspired color palettes',
    time: '08:15',
    icon: 'sparkles',
  },
];

export default function HomeScreen({ onStartChat, onNavigate }: HomeScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {/* Phone Container */}
      <div className="max-w-sm w-full mx-auto h-full flex flex-col rounded-3xl border-2 border-purple-500/30 overflow-hidden bg-gradient-to-b from-purple-900/10 to-black">
        {/* Status Bar */}
        <div className="flex justify-between items-center px-6 pt-4 text-xs text-white bg-black/50 border-b border-gray-800/50">
          <span className="font-medium">9:41</span>
          <div className="flex gap-1 items-center">
            <MessageCircle className="w-3.5 h-3.5" />
            <Zap className="w-3.5 h-3.5" />
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-6 flex justify-between items-center bg-black/50 border-b border-gray-800/50 relative">
          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-lg p-2 transition-all duration-200"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute top-12 left-0 bg-gray-900 border border-gray-800 rounded-lg shadow-lg shadow-black/50 z-50 min-w-48">
                <button 
                  onClick={() => {
                    onNavigate?.('settings');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-purple-500/10 transition-all duration-200 text-sm border-b border-gray-800"
                >
                  Profile
                </button>
                <button 
                  onClick={() => {
                    onNavigate?.('settings');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-purple-500/10 transition-all duration-200 text-sm border-b border-gray-800"
                >
                  Preferences
                </button>
                <button 
                  onClick={() => {
                    onNavigate?.('settings');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-purple-500/10 transition-all duration-200 text-sm border-b border-gray-800"
                >
                  Help & Support
                </button>
                <button 
                  className="w-full px-4 py-3 text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 text-sm"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xs font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
              Online
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
            SK
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 bg-gradient-to-b from-black/30 to-black">
          {/* Greeting */}
          <div>
            <h2 className="text-white text-xl font-semibold mb-2">Hi, Sakib <span className="text-2xl">👋</span></h2>
            <p className="text-gray-300 text-lg">How may I help you today?</p>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onStartChat()}
              className="bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 active:from-purple-800 active:to-purple-950 rounded-2xl p-4 text-left transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Zap className="w-6 h-6 text-white mb-2" />
                  <p className="text-white font-semibold text-sm">Talk with</p>
                  <p className="text-white font-semibold text-sm">Bot</p>
                </div>
                <Send className="w-5 h-5 text-white/70" />
              </div>
            </button>

            <button
              onClick={() => onStartChat()}
              className="bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 active:from-purple-800 active:to-purple-950 rounded-2xl p-4 text-left transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
            >
              <div className="flex items-start justify-between">
                <div>
                  <MessageSquare className="w-6 h-6 text-white mb-2" />
                  <p className="text-white font-semibold text-sm">Chat with</p>
                  <p className="text-white font-semibold text-sm">Bot</p>
                </div>
                <Send className="w-5 h-5 text-white/70" />
              </div>
            </button>

            <button
              onClick={() => onStartChat()}
              className="bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 active:from-purple-700 active:to-purple-900 rounded-2xl p-4 text-left transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105 col-span-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Image className="w-6 h-6 text-white mb-2" />
                  <p className="text-white font-semibold text-sm">Search by Image</p>
                </div>
                <Send className="w-5 h-5 text-white/70" />
              </div>
            </button>
          </div>

          {/* History Section */}
          <div className="pt-2">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-white font-semibold text-lg">History</h3>
              <button 
                onClick={() => onNavigate?.('chats')}
                className="text-purple-400 text-sm hover:text-purple-300 hover:bg-purple-400/10 px-3 py-1 rounded-lg transition-all duration-200"
              >
                See all
              </button>
            </div>

            <div className="space-y-3">
              {mockConversations.map((conv) => {
                const getIcon = (iconName: string) => {
                  switch (iconName) {
                    case 'brain':
                      return <Brain className="w-5 h-5 text-purple-400" />;
                    case 'palette':
                      return <Palette className="w-5 h-5 text-purple-400" />;
                    case 'sparkles':
                      return <Sparkles className="w-5 h-5 text-purple-400" />;
                    default:
                      return <Zap className="w-5 h-5 text-purple-400" />;
                  }
                };

                return (
                  <button
                    key={conv.id}
                    onClick={() => onStartChat(conv)}
                    className="w-full bg-gray-900/30 hover:bg-gray-800/50 active:bg-gray-800 rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:translate-x-1 border border-gray-800/30 hover:border-purple-500/30 shadow-sm hover:shadow-purple-500/10"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-700/40 flex items-center justify-center shadow-lg shadow-purple-500/10">
                        {getIcon(conv.icon)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-medium text-sm">{conv.botName}</p>
                        <p className="text-gray-400 text-xs line-clamp-1">{conv.preview}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <span className="text-gray-500 text-xs font-medium">{conv.time}</span>
                      <MessageCircle className="w-4 h-4 text-gray-500 group-hover:text-purple-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="border-t border-gray-800/50 bg-black/50 flex justify-around items-center h-20 px-6 backdrop-blur-sm">
          <button 
            onClick={() => {}}
            className="flex flex-col items-center gap-1 text-white hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button 
            onClick={() => onNavigate?.('chats')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Chat</span>
          </button>
          <button 
            onClick={() => onNavigate?.('friends')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <Users className="w-6 h-6" />
            <span className="text-xs font-medium">Friends</span>
          </button>
          <button 
            onClick={() => onNavigate?.('settings')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">Setting</span>
          </button>
        </div>
      </div>
    </div>
  );
}
