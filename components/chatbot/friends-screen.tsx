'use client';

import { useState } from 'react';
import { Search, Home, MessageCircle, Users, Settings, Signal, Wifi, Battery, UserPlus, Send, MoreVertical } from 'lucide-react';

interface Friend {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'away';
  lastActive?: string;
  avatar: string;
}

interface FriendsScreenProps {
  onNavigate: (page: string) => void;
}

export default function FriendsScreen({ onNavigate }: FriendsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([
    {
      id: '1',
      name: 'Alex Johnson',
      status: 'online',
      avatar: 'AJ',
    },
    {
      id: '2',
      name: 'Sarah Williams',
      status: 'online',
      avatar: 'SW',
    },
    {
      id: '3',
      name: 'Mike Chen',
      status: 'away',
      lastActive: '5m ago',
      avatar: 'MC',
    },
    {
      id: '4',
      name: 'Emma Davis',
      status: 'offline',
      lastActive: '2h ago',
      avatar: 'ED',
    },
    {
      id: '5',
      name: 'James Wilson',
      status: 'online',
      avatar: 'JW',
    },
    {
      id: '6',
      name: 'Lisa Anderson',
      status: 'offline',
      lastActive: '1d ago',
      avatar: 'LA',
    },
  ]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineFriends = filteredFriends.filter(f => f.status === 'online');
  const otherFriends = filteredFriends.filter(f => f.status !== 'online');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const removeFriend = (id: string) => {
    setFriends(friends.filter(f => f.id !== id));
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
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-white font-semibold text-lg">Friends</h1>
            <button className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-full p-2 transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900/60 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 pl-10 border border-gray-700/50 hover:border-gray-600 focus:border-purple-500 focus:outline-none transition-all duration-200 focus:bg-gray-900 shadow-lg shadow-gray-900/20 text-sm"
            />
          </div>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4">
          {/* Online Friends */}
          {onlineFriends.length > 0 && (
            <div>
              <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 mb-3">
                Online ({onlineFriends.length})
              </h2>
              <div className="space-y-2">
                {onlineFriends.map((friend) => (
                  <div key={friend.id} className="relative">
                    <div className="bg-gray-900/30 hover:bg-gray-800/50 active:bg-gray-800 rounded-xl p-3 flex items-center justify-between transition-all duration-200 hover:translate-x-1 border border-gray-800/30 hover:border-purple-500/30 shadow-sm hover:shadow-purple-500/10">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-lg shadow-purple-500/30">
                            {friend.avatar}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${getStatusColor(friend.status)}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-white font-medium text-sm">{friend.name}</p>
                          <p className="text-green-400 text-xs">Online</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-full p-2 transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40">
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === friend.id ? null : friend.id)}
                          className="text-gray-500 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Menu */}
                    {openMenuId === friend.id && (
                      <div className="absolute right-3 top-12 bg-gray-800 rounded-lg shadow-xl shadow-black/50 overflow-hidden border border-gray-700/50 z-20 w-40 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button className="w-full text-left px-4 py-2.5 text-white hover:bg-purple-600/20 transition-colors duration-200 flex items-center gap-2 text-sm font-medium border-b border-gray-700/30">
                          <MessageCircle className="w-4 h-4" />
                          View Profile
                        </button>
                        <button
                          onClick={() => removeFriend(friend.id)}
                          className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-red-600/20 transition-colors duration-200 flex items-center gap-2 text-sm font-medium"
                        >
                          <Users className="w-4 h-4" />
                          Remove Friend
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Friends */}
          {otherFriends.length > 0 && (
            <div>
              <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 mb-3">
                Others ({otherFriends.length})
              </h2>
              <div className="space-y-2">
                {otherFriends.map((friend) => (
                  <div key={friend.id} className="relative">
                    <div className="bg-gray-900/30 hover:bg-gray-800/50 active:bg-gray-800 rounded-xl p-3 flex items-center justify-between transition-all duration-200 hover:translate-x-1 border border-gray-800/30 hover:border-purple-500/30 shadow-sm hover:shadow-purple-500/10">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-lg shadow-gray-500/20">
                            {friend.avatar}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${getStatusColor(friend.status)}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-white font-medium text-sm">{friend.name}</p>
                          <p className="text-gray-500 text-xs">
                            {friend.status === 'away' ? 'Away' : `Last active ${friend.lastActive}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button className="bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white rounded-full p-2 transition-all duration-200 shadow-lg shadow-gray-500/20 hover:shadow-gray-500/40">
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === friend.id ? null : friend.id)}
                          className="text-gray-500 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Menu */}
                    {openMenuId === friend.id && (
                      <div className="absolute right-3 top-12 bg-gray-800 rounded-lg shadow-xl shadow-black/50 overflow-hidden border border-gray-700/50 z-20 w-40 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button className="w-full text-left px-4 py-2.5 text-white hover:bg-purple-600/20 transition-colors duration-200 flex items-center gap-2 text-sm font-medium border-b border-gray-700/30">
                          <MessageCircle className="w-4 h-4" />
                          View Profile
                        </button>
                        <button
                          onClick={() => removeFriend(friend.id)}
                          className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-red-600/20 transition-colors duration-200 flex items-center gap-2 text-sm font-medium"
                        >
                          <Users className="w-4 h-4" />
                          Remove Friend
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredFriends.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mb-3 opacity-50" />
              <p className="text-gray-400 text-sm">No friends found</p>
            </div>
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
        <button
          onClick={() => onNavigate('chats')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Chats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl">
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
