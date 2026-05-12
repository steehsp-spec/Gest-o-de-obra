import React from 'react';

interface ProgressBarProps {
  progress: number;
  mode?: 'simple' | 'detailed';
  onUpdate?: (val: number) => void;
  className?: string;
}

const getProgressColor = (progress: number) => {
  if (progress <= 0) return '#374151'; // gray-700
  if (progress < 25) return '#EF4444'; // red-500
  if (progress < 50) return '#FACC15'; // yellow-400
  if (progress < 75) return '#2563EB'; // blue-600
  if (progress < 100) return '#8B5CF6'; // violet-500
  return '#16A34A'; // emerald-600
};

export const ProgressBar = ({ progress, mode = 'simple', onUpdate, className = "" }: ProgressBarProps) => {
  const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const markers = [0, 25, 50, 75, 100];
  const color = getProgressColor(safeProgress);

  if (mode === 'simple') {
    return (
      <div className={`w-full ${className}`}>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-500 ease-out" 
            style={{ 
              width: `${safeProgress}%`, 
              backgroundColor: color 
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="relative w-full">
        {/* Track */}
        <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
          {/* Progress Fill */}
          <div 
            className="h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(0,0,0,0.3)]" 
            style={{ 
              width: `${safeProgress}%`, 
              backgroundColor: color,
              boxShadow: safeProgress === 100 ? `0 0 10px ${color}` : 'none'
            }} 
          />
          
          {/* Overlay Grid */}
          <div className="absolute inset-0 flex justify-between px-0.5 pointer-events-none">
            {markers.map(m => (
              <div key={m} className={`w-[1px] h-full ${m === 0 || m === 100 ? 'bg-transparent' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Numerical Scale Markers - INTERACTIVE STEPS */}
      <div className="flex justify-between items-center gap-1">
        {markers.map(m => (
          <button 
            key={m} 
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdate) onUpdate(m);
            }}
            className={`
              flex-1 py-1 rounded text-[8px] font-black tracking-tighter transition-all
              ${safeProgress === m ? 'bg-white/20 text-white shadow-lg ring-1 ring-white/30' : 
                safeProgress >= m ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-white/10 hover:text-white/30 hover:bg-white/5'}
            `}
          >
            {m}%
          </button>
        ))}
      </div>
    </div>
  );
};
