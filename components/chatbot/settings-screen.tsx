'use client';

import { useState } from 'react';
import { Home, MessageCircle, Users, Settings, Signal, Wifi, Battery, Bell, Moon, Lock, HelpCircle, LogOut, ChevronRight, MapPin } from 'lucide-react';

interface SettingsScreenProps {
  onNavigate: (page: string) => void;
  onLogout?: () => void;
}

export default function SettingsScreen({ onNavigate, onLogout }: SettingsScreenProps) {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [privateMode, setPrivateMode] = useState(false);
  const [location, setLocation] = useState(true);

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
        checked ? 'bg-purple-600 shadow-lg shadow-purple-500/30' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const SettingItem = ({
    icon: Icon,
    label,
    description,
    toggle,
    checked,
    onChange,
    onClick,
  }: {
    icon: any;
    label: string;
    description?: string;
    toggle?: boolean;
    checked?: boolean;
    onChange?: (value: boolean) => void;
    onClick?: () => void;
  }) => (
    <button
      onClick={onClick}
      className="w-full bg-gray-900/30 hover:bg-gray-800/50 active:bg-gray-800 rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:translate-x-1 border border-gray-800/30 hover:border-purple-500/30 shadow-sm hover:shadow-purple-500/10"
    >
      <div className="flex items-center gap-3 flex-1">
        <Icon className="w-5 h-5 text-purple-400 flex-shrink-0" />
        <div className="text-left">
          <p className="text-white font-medium text-sm">{label}</p>
          {description && <p className="text-gray-400 text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      {toggle ? (
        <ToggleSwitch checked={checked || false} onChange={onChange || (() => {})} />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-500" />
      )}
    </button>
  );

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
          <h1 className="text-white font-semibold text-lg">Settings</h1>
        </div>

        {/* Settings List */}
        <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4">
          {/* Profile Section */}
          <div>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 mb-3">Profile</h2>
            <div className="space-y-2">
              <button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 active:from-purple-800 active:to-purple-900 rounded-xl p-4 flex items-center justify-between transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
                    SK
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium text-sm">Sakib</p>
                    <p className="text-purple-200 text-xs">View & Edit Profile</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>

          {/* Preferences Section */}
          <div>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 mb-3">Preferences</h2>
            <div className="space-y-2">
              <SettingItem
                icon={Bell}
                label="Notifications"
                description="Manage notification settings"
                toggle
                checked={notifications}
                onChange={setNotifications}
              />
              <SettingItem
                icon={Moon}
                label="Dark Mode"
                description="Always enabled for best experience"
                toggle
                checked={darkMode}
                onChange={setDarkMode}
              />
              <SettingItem
                icon={MapPin}
                label="Location Services"
                description="Allow location access"
                toggle
                checked={location}
                onChange={setLocation}
              />
            </div>
          </div>

          {/* Privacy & Security Section */}
          <div>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 mb-3">Privacy & Security</h2>
            <div className="space-y-2">
              <SettingItem
                icon={Lock}
                label="Private Mode"
                description="Encrypt your conversations"
                toggle
                checked={privateMode}
                onChange={setPrivateMode}
              />
              <SettingItem
                icon={Lock}
                label="Password"
                description="Change your password"
                onClick={() => {}}
              />
              <SettingItem
                icon={Lock}
                label="Privacy Policy"
                description="Review privacy terms"
                onClick={() => {}}
              />
            </div>
          </div>

          {/* Support Section */}
          <div>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 mb-3">Support</h2>
            <div className="space-y-2">
              <SettingItem
                icon={HelpCircle}
                label="Help & Support"
                description="Get help with your account"
                onClick={() => {}}
              />
              <SettingItem
                icon={HelpCircle}
                label="About"
                description="App version 1.0.0"
                onClick={() => {}}
              />
            </div>
          </div>

          {/* Logout Section */}
          <div>
            <button
              onClick={handleLogout}
              className="w-full bg-red-600/20 hover:bg-red-600/30 active:bg-red-600/40 border border-red-500/30 rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:translate-x-1"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-400" />
                <p className="text-red-400 font-medium text-sm">Logout</p>
              </div>
              <ChevronRight className="w-5 h-5 text-red-400/70" />
            </button>
          </div>
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
        <button
          onClick={() => onNavigate('friends')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl"
        >
          <Users className="w-6 h-6" />
          <span className="text-xs font-medium">Friends</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white hover:text-purple-400 transition-all duration-200 hover:bg-purple-400/10 px-4 py-2 rounded-xl">
          <Settings className="w-6 h-6" />
          <span className="text-xs font-medium">Setting</span>
        </button>
      </div>
    </div>
  );
}
