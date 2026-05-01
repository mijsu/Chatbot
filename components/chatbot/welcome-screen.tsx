import { Button } from '@/components/ui/button';
import { Signal, Wifi, Battery } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-purple-900 via-black to-black">
      <div className="max-w-sm w-full">
        {/* Status Bar */}
        <div className="flex justify-between items-center mb-8 text-xs text-white px-2">
          <span>9:41</span>
          <div className="flex gap-1">
            <Signal className="w-4 h-4" />
            <Wifi className="w-4 h-4" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Container with border */}
        <div className="rounded-3xl border-2 border-purple-500/30 p-6 bg-gradient-to-b from-purple-900/20 to-black/40 backdrop-blur-sm">
          {/* App Badge */}
          <div className="flex justify-center mb-8">
            <span className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">
              Personal AI Buddy
            </span>
          </div>

          {/* Robot Illustration */}
          <div className="flex justify-center mb-8 h-64">
            <div className="relative w-48 h-48">
              {/* Decorative background waves */}
              <svg
                className="absolute inset-0 w-full h-full opacity-30"
                viewBox="0 0 200 200"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="0.5"
              >
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="30" />
                <circle cx="100" cy="100" r="50" />
                <circle cx="100" cy="100" r="70" />
                <circle cx="100" cy="100" r="90" />
              </svg>

              {/* Robot Body */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Head */}
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-300 via-blue-400 to-purple-600 relative overflow-hidden">
                    {/* Eyes */}
                    <div className="absolute inset-0 flex items-center justify-center gap-6">
                      <div className="w-6 h-6 bg-purple-800 rounded-full relative">
                        <div className="absolute inset-1 bg-white rounded-full" />
                      </div>
                      <div className="w-6 h-6 bg-purple-800 rounded-full relative">
                        <div className="absolute inset-1 bg-white rounded-full" />
                      </div>
                    </div>

                    {/* Mouth */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                      <div className="w-8 h-2 bg-purple-800 rounded-full opacity-60" />
                    </div>

                    {/* Shine/highlight */}
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/40 blur-sm" />
                  </div>

                  {/* Body */}
                  <div className="w-24 h-20 bg-gradient-to-b from-cyan-300 to-blue-500 rounded-2xl mt-2 relative">
                    <div className="absolute top-2 left-0 right-0 flex justify-center gap-4">
                      <div className="w-3 h-8 bg-purple-700 rounded-full" />
                      <div className="w-3 h-8 bg-purple-700 rounded-full" />
                    </div>
                  </div>

                  {/* Arms */}
                  <div className="absolute top-12 -left-8 w-8 h-3 bg-cyan-300 rounded-full rotate-12" />
                  <div className="absolute top-12 -right-8 w-8 h-3 bg-cyan-300 rounded-full -rotate-12" />
                </div>
              </div>
            </div>
          </div>

          {/* Text */}
          <h1 className="text-white text-2xl font-bold text-center mb-8 text-balance">
            How may I help you today!
          </h1>

          {/* Get Started Button */}
          <Button
            onClick={onGetStarted}
            className="w-full bg-white text-black hover:bg-gray-100 active:bg-gray-200 font-semibold py-6 rounded-xl text-base h-auto transition-all duration-200 shadow-lg shadow-white/20 hover:shadow-white/40 hover:scale-105"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
