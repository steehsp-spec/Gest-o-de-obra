import React, { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface InlineDateInputProps {
  value: string;
  onUpdate: (date: string) => Promise<void>;
  className?: string;
}

export const InlineDateInput: React.FC<InlineDateInputProps> = ({ value, onUpdate, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [date, setDate] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setDate(value);
  }, [value]);

  const handleSave = async (newDate: string) => {
    if (!newDate || newDate === value) {
      setIsEditing(false);
      setDate(value);
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    try {
      // Validate format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        throw new Error('Data inválida');
      }
      
      await onUpdate(newDate);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Erro ao salvar data:', error);
      setStatus('error');
      setDate(value); // Revert on error
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (!isLoading) {
      handleSave(date);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave(date);
    } else if (e.key === 'Escape') {
      setDate(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative flex items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isLoading}
          className={`bg-[#0B0E14] border border-[#F97316] text-white text-sm rounded px-1 py-0.5 w-full focus:outline-none disabled:opacity-50 ${className}`}
        />
        {isLoading && (
          <div className="absolute right-1">
            <Loader2 className="w-3 h-3 animate-spin text-[#F97316]" />
          </div>
        )}
      </div>
    );
  }

  const formatDate = (val: string) => {
    if (!val) return 'Data inválida';
    const parts = val.split('-');
    if (parts.length !== 3) return 'Data inválida';
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="flex items-center gap-2 group">
      <span 
        onClick={() => !isLoading && setIsEditing(true)}
        className={`cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded transition-colors ${className}`}
      >
        {formatDate(value)}
      </span>
      {isLoading && <Loader2 className="w-3 h-3 animate-spin text-[#F97316]" />}
      {status === 'success' && <Check className="w-3 h-3 text-green-500" />}
      {status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
    </div>
  );
};
