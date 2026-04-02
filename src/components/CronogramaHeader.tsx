import React from 'react';
import { Calendar, Loader2, Eye, Download, Plus, Check, AlertTriangle } from 'lucide-react';

interface CronogramaHeaderProps {
  startDate: string;
  totalDays: number | '';
  onStartDateChange: (date: string) => void;
  onTotalDaysChange: (days: number | '') => void;
  onGenerate: () => void;
  isGenerating: boolean;
  expectedEndDate: string;
  status: 'Dentro do prazo' | 'Atrasado';
  onToggleColumnMenu: () => void;
  onExportPdf: () => void;
  onAddEtapa: () => void;
}

export const CronogramaHeader: React.FC<CronogramaHeaderProps> = ({
  startDate,
  totalDays,
  onStartDateChange,
  onTotalDaysChange,
  onGenerate,
  isGenerating,
  expectedEndDate,
  status,
  onToggleColumnMenu,
  onExportPdf,
  onAddEtapa
}) => {
  return (
    <div className="bg-[#161B22] p-6 rounded-2xl border border-white/10 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">Cronograma Executivo</h1>
        <div className="flex items-center gap-2">
          <button onClick={onToggleColumnMenu} className="bg-[#0B0E14] border border-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-white/5 transition-colors">
            <Eye size={16} /> Visualização de Colunas
          </button>
          <button onClick={onExportPdf} className="bg-[#0B0E14] border border-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-white/5 transition-colors">
            <Download size={16} /> Exportar PDF
          </button>
          <button onClick={onAddEtapa} className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors">
            <Plus size={16} /> Nova Etapa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B0E14] p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Dias Totais</label>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              className="bg-transparent text-lg font-bold text-white w-full outline-none"
              value={totalDays}
              onChange={(e) => onTotalDaysChange(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="0"
            />
            <span className="text-gray-500 text-xs">dias</span>
          </div>
        </div>
        <div className="bg-[#0B0E14] p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Data Início</label>
          <input 
            type="date" 
            className="bg-transparent text-lg font-bold text-white w-full outline-none"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="bg-[#0B0E14] p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Data Prevista</label>
          <div className="text-lg font-bold text-white">{expectedEndDate || '-'}</div>
        </div>
        <div className="bg-[#0B0E14] p-4 rounded-xl border border-white/10 flex items-center justify-between">
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Status</label>
            <div className={`text-lg font-bold ${status === 'Dentro do prazo' ? 'text-emerald-400' : 'text-red-400'}`}>{status}</div>
          </div>
          {status === 'Dentro do prazo' ? <Check size={20} className="text-emerald-400" /> : <AlertTriangle size={20} className="text-red-400" />}
        </div>
      </div>
    </div>
  );
};
