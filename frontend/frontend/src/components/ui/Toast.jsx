import React, { useEffect, useState } from 'react';
import { X, Activity, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose, duration = 5000, index = 0 }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    info: <Info className="w-5 h-5 text-blue-500" />,
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
    error: <X className="w-5 h-5 text-red-500" />,
    audit: <Activity className="w-5 h-5 text-purple-500" />
  };

  const bgColors = {
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-900',
    success: 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-900',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-900',
    error: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900',
    audit: 'bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-900'
  };

  return (
    <div
      style={{ bottom: `${1 + index * 4.75}rem` }}
      className={`fixed right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${bgColors[type]}`}
    >
      {icons[type]}
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">{message.title}</p>
        <p className="text-xs text-gray-600 dark:text-neutral-300">{message.description}</p>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="ml-2 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
      </button>
    </div>
  );
}
