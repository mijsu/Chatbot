'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Home, MessageCircle, Users, Settings, Signal, Wifi, Battery } from 'lucide-react';

interface Conversation {
  id: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
}

interface ChatScreenProps {
  conversation?: Conversation | null;
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  botName?: string;
}

export default function ChatScreen({ conversation, onBack, onNavigate }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: 'Human: Hello! How can I improve my programming skills?',
    },
    {
      id: '2',
      role: 'assistant',
      content:
        'AI: Hello! The first step to improve your programming skills is choosing a programming language. Do you have a specific language in mind?',
      botName: 'Chat Opt',
    },
    {
      id: '3',
      role: 'user',
      content: 'Human: Yes, I think Python might be interesting. Where should I start?',
    },
    {
      id: '4',
      role: 'assistant',
      content:
        'AI: Great choice! Start by learning basic concepts like variables, conditional statements, and loops. Try to start small projects to gain practical experience. You can start with writing a simple program like a calculator or a list manager.',
      botName: 'Chat Opt',
    },
  ]);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `Human: ${input}`,
      };
      setMessages([...messages, newMessage]);

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `AI: That's a great question! I'd be happy to help you with that.`,
          botName: 'Chat Opt',
        };
        setMessages((prev) => [...prev, aiResponse]);
      }, 500);

      setInput('');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {/* Phone Container */}
      <div className="max-w-sm w-full mx-auto h-full flex flex-col rounded-3xl border-2 border-purple-500/30 overflow-hidden bg-gradient-to-b from-purple-900/10 to-black">
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
        <div className="px-6 py-4 flex items-center gap-4 bg-black/50 border-b border-gray-800/50 backdrop-blur-sm">
          <button 
            onClick={onBack} 
            className="text-white hover:text-purple-400 hover:bg-gray-800/30 p-2 rounded-lg transition-all duration-200"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold text-lg flex-1">AI Chat</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-black/30 to-black">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-500/30">
                  AI
                </div>
              )}

              <div
                className={`max-w-xs px-4 py-3 rounded-2xl transition-all duration-200 ${
                  message.role === 'user'
                    ? 'bg-gray-800 text-white rounded-3xl shadow-lg shadow-gray-800/50'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-600/30'
                }`}
              >
                {message.botName && (
                  <p className="text-xs font-semibold mb-1.5 text-purple-200 opacity-90">{message.botName}</p>
                )}
                <p className="text-sm leading-relaxed text-pretty">{message.content}</p>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-500/30">
                  U
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800/50 bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Write a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-gray-900/60 text-white placeholder-gray-500 rounded-2xl px-4 py-3 border border-gray-700/50 hover:border-gray-600 focus:border-purple-500 focus:outline-none transition-all duration-200 focus:bg-gray-900 shadow-lg shadow-gray-900/20"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 active:from-purple-800 active:to-purple-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full p-3 flex items-center justify-center transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="border-t border-gray-800/50 bg-black/50 flex justify-around items-center h-16 px-6 backdrop-blur-sm">
          <button 
            onClick={() => onNavigate?.('home')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <Home className="w-6 h-6" />
          </button>
          <button className="flex flex-col items-center gap-1 text-white hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl">
            <MessageCircle className="w-6 h-6" />
          </button>
          <button 
            onClick={() => onNavigate?.('friends')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <Users className="w-6 h-6" />
          </button>
          <button 
            onClick={() => onNavigate?.('settings')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
