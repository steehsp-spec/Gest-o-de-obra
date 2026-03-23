import React, { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface InlineDateInputProps {
  value: string;
  onUpdate: (date: string) => Promise<void>;
}

export const InlineDateInput: React.FC<InlineDateInputProps> = ({ value, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [date, setDate] = useState(value.split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setDate(value.split('T')[0]);
  }, [value]);

  const handleSave = async (newDate: string) => {
    if (!newDate || newDate === value.split('T')[0]) {
      setIsEditing(false);
      setDate(value.split('T')[0]);
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    try {
      // Validar se a data é válida antes de converter
      const dateObj = new Date(newDate + 'T12:00:00');
      if (isNaN(dateObj.getTime())) {
        throw new Error('Data inválida');
      }
      
      const isoDate = dateObj.toISOString();
      await onUpdate(isoDate);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Erro ao salvar data:', error);
      setStatus('error');
      setDate(value.split('T')[0]); // Revert on error
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
      setDate(value.split('T')[0]);
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
          className="bg-[#0B0E14] border border-[#F97316] text-white text-sm rounded px-1 py-0.5 w-full focus:outline-none disabled:opacity-50"
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
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return 'Data inválida';
      return d.toLocaleDateString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <div className="flex items-center gap-2 group">
      <span 
        onClick={() => !isLoading && setIsEditing(true)}
        className="cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
      >
        {formatDate(value)}
      </span>
      {isLoading && <Loader2 className="w-3 h-3 animate-spin text-[#F97316]" />}
      {status === 'success' && <Check className="w-3 h-3 text-green-500" />}
      {status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
    </div>
  );
};
