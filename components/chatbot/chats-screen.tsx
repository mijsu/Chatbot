'use client';

import { useState } from 'react';
import { Search, MoreVertical, Home, MessageCircle, Users, Settings, Signal, Wifi, Battery, Trash2, Pin } from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  preview: string;
  timestamp: string;
  unread: number;
  avatar: string;
}

interface ChatsScreenProps {
  onSelectChat: (chat: Chat) => void;
  onNavigate: (page: string) => void;
}

export default function ChatsScreen({ onSelectChat, onNavigate }: ChatsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<Chat[]>([
    {
      id: '1',
      name: 'ChatGPT',
      preview: 'The best way to learn programming...',
      timestamp: 'Yesterday',
      unread: 2,
      avatar: 'CG',
    },
    {
      id: '2',
      name: 'Midjourney',
      preview: 'Here are some design concepts...',
      timestamp: '2 days ago',
      unread: 0,
      avatar: 'MJ',
    },
    {
      id: '3',
      name: 'Google AI',
      preview: 'Let me help you with that query...',
      timestamp: '3 days ago',
      unread: 1,
      avatar: 'GA',
    },
    {
      id: '4',
      name: 'Claude',
      preview: 'I can help you with that task...',
      timestamp: '1 week ago',
      unread: 0,
      avatar: 'CL',
    },
  ]);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteChat = (id: string) => {
    setChats(chats.filter(chat => chat.id !== id));
    setOpenMenuId(null);
  };

  const pinChat = (id: string) => {
    const chat = chats.find(c => c.id === id);
    if (chat) {
      setChats([
        chat,
        ...chats.filter(c => c.id !== id)
      ]);
    }
    setOpenMenuId(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-black">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Status Bar */}
        <div className="flex justify-between items-center px-6 pt-4 text-xs text-white bg-black/50 border-b border-gray-800/50">
          <span className="font-medium">9:41</span>
          <div className="flex gap-1 items-center">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Header */}
        <div className="px-6 py-4 bg-black/50 border-b border-gray-800/50 backdrop-blur-sm">
          <h1 className="text-white font-semibold text-lg mb-4">Messages</h1>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900/60 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 pl-10 border border-gray-700/50 hover:border-gray-600 focus:border-purple-500 focus:outline-none transition-all duration-200 focus:bg-gray-900 shadow-lg shadow-gray-900/20 text-sm"
            />
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="w-12 h-12 text-gray-600 mb-3 opacity-50" />
              <p className="text-gray-400 text-sm">No chats found</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div key={chat.id} className="relative">
                <button
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    onSelectChat(chat);
                  }}
                  className="w-full bg-gray-900/30 hover:bg-gray-800/50 active:bg-gray-800 rounded-xl p-3 flex items-center justify-between transition-all duration-200 hover:translate-x-1 border border-gray-800/30 hover:border-purple-500/30 shadow-sm hover:shadow-purple-500/10 relative z-10"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-lg shadow-purple-500/30">
                      {chat.avatar}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white font-medium text-sm">{chat.name}</p>
                      <p className="text-gray-400 text-xs line-clamp-1">{chat.preview}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
                    <span className="text-gray-500 text-xs font-medium whitespace-nowrap">{chat.timestamp}</span>
                    {chat.unread > 0 && (
                      <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold shadow-lg shadow-purple-500/30">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </button>

                {/* Context Menu Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200 z-20"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {openMenuId === chat.id && (
                  <div className="absolute right-3 top-12 bg-gray-800 rounded-lg shadow-xl shadow-black/50 overflow-hidden border border-gray-700/50 z-20 w-40 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => pinChat(chat.id)}
                      className="w-full text-left px-4 py-2.5 text-white hover:bg-purple-600/20 transition-colors duration-200 flex items-center gap-2 text-sm font-medium border-b border-gray-700/30"
                    >
                      <Pin className="w-4 h-4" />
                      Pin Chat
                    </button>
                    <button
                      onClick={() => deleteChat(chat.id)}
                      className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-red-600/20 transition-colors duration-200 flex items-center gap-2 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-800/50 bg-black/50 flex justify-around items-center h-20 px-6 backdrop-blur-sm">
        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
        >
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl">
          <MessageCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Chats</span>
        </button>
        <button
          onClick={() => onNavigate('friends')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
        >
          <Users className="w-6 h-6" />
          <span className="text-xs font-medium">Friends</span>
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
        >
          <Settings className="w-6 h-6" />
          <span className="text-xs font-medium">Setting</span>
        </button>
      </div>
    </div>
  );
}
