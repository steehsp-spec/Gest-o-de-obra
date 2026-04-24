import React, { useState, useEffect } from 'react';
import { Plus, Download, Layout, Calendar, ChevronRight, ChevronDown, Edit2, Trash2, AlertCircle, Filter } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { getDaysBetween, addDays } from '../../utils/dateUtils';
import { InlineDateInput } from '../InlineDateInput';

export const CronogramaHeader = ({ 
  onAddEtapa, 
  onExportPdf, 
  onRecalculate,
  projects,
  selectedProjectId,
  onSelectProject
}: { 
  onAddEtapa: () => void, 
  onExportPdf: () => void, 
  onRecalculate: () => void,
  projects: any[],
  selectedProjectId: string,
  onSelectProject: (id: string) => void
}) => (
  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-4">
      <h1 className="text-2xl font-bold text-white whitespace-nowrap">Cronograma Executivo</h1>
      <select 
        value={selectedProjectId}
        onChange={(e) => onSelectProject(e.target.value)}
        className="bg-[#161B22] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F97316]"
      >
        <option value="">Selecionar Obra</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onRecalculate} className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 text-sm flex items-center gap-2 transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Recalcular
      </button>
      <button onClick={onExportPdf} className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 text-sm flex items-center gap-2 transition-all"><Download size={16} /> PDF</button>
      <button onClick={onAddEtapa} className="px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#F97316]/90 text-sm flex items-center gap-2 transition-all"><Plus size={16} /> Nova Etapa</button>
    </div>
  </div>
);

const getProgressStyle = (progress: number) => {
  if (progress <= 0) return { backgroundColor: '#374151' }; // gray-700 (cinza escuro)
  if (progress < 50) return { backgroundColor: '#FACC15' }; // yellow-400 (amarelo)
  if (progress < 75) return { backgroundColor: '#2563EB' }; // blue-600 (azul)
  if (progress < 100) return { backgroundColor: '#8B5CF6' }; // roxo (75-99%)
  return { 
    backgroundColor: '#16A34A', // verde forte (100%)
    boxShadow: '0 0 6px rgba(34,197,94,0.4)'
  };
};

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'concluido':
      return { label: 'Finalizado', color: 'bg-[#16A34A] text-white shadow-[0_0_6px_rgba(34,197,94,0.4)]' };
    case 'finalizando':
      return { label: 'Finalizando', color: 'bg-[#8B5CF6] text-white' };
    case 'revisao':
      return { label: 'Revisão', color: 'bg-blue-600 text-white' };
    case 'em_processo':
    case 'em_andamento':
      return { label: 'Em Processo', color: 'bg-yellow-400 text-black' };
    case 'atrasado':
      return { label: 'Atrasado', color: 'bg-red-500/10 text-red-500' };
    default:
      return { label: 'Pendente', color: 'bg-gray-500/10 text-gray-500' };
  }
};

export const SummaryPanel = ({ data }: { data: any }) => (
  <div className="flex flex-col gap-6 mb-8">
    {/* 2. CARD DE STATUS - Elegant Alert Style */}
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      data.status === 'Atrasado' 
        ? 'bg-red-500/10 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
        : 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
    }`}>
      <div className={`p-3 rounded-xl ${
        data.status === 'Atrasado' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
      }`}>
        <AlertCircle size={28} />
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-0.5">Status do Cronograma</p>
        <div className="flex items-center gap-3">
          <h2 className={`text-2xl font-black tracking-tight ${
            data.status === 'Atrasado' ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {data.status}
          </h2>
          <div className={`h-2 w-2 rounded-full animate-pulse ${
            data.status === 'Atrasado' ? 'bg-red-500' : 'bg-emerald-500'
          }`} />
        </div>
      </div>
      <div className="hidden sm:block text-right border-l border-white/10 pl-6">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Monitoramento Real</p>
        <p className="text-xs text-gray-400 font-medium italic">Sincronizado com a base de dados</p>
      </div>
    </div>

    {/* 3. CARDS SUPERIORES - Compact and Functional */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#161B22] p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Dias Totais</p>
        <div className="text-xl font-black text-white">{data.totalDays}</div>
      </div>
      <div className="bg-[#161B22] p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Início</p>
        <div className="text-xl font-black text-white">{data.startDate}</div>
      </div>
      <div className="bg-[#161B22] p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Prevista</p>
        <div className="text-xl font-black text-white">{data.expectedDate}</div>
      </div>
      <div className="bg-[#161B22] p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Progresso</p>
        <div className="flex items-center gap-2">
          <div className="text-xl font-black text-white">{data.progress}%</div>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500" 
              style={{ width: `${data.progress}%`, ...getProgressStyle(data.progress) }} 
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const QuickProgress = ({ current, onUpdate, size = 'md' }: { current: number, onUpdate: (val: number) => void, size?: 'sm' | 'md' }) => {
  const options = [
    { val: 0, color: 'bg-gray-700', activeText: 'text-white' },
    { val: 25, color: 'bg-yellow-400', activeText: 'text-black' },
    { val: 50, color: 'bg-blue-600', activeText: 'text-white' },
    { val: 75, color: 'bg-[#8B5CF6]', activeText: 'text-white' },
    { val: 100, color: 'bg-[#16A34A]', activeText: 'text-white' }
  ];

  return (
    <div className="flex items-center gap-1.5 relative z-10">
      {options.map(opt => (
        <button
          key={opt.val}
          onClick={(e) => { e.stopPropagation(); onUpdate(opt.val); }}
          className={`
            ${size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'}
            rounded font-bold transition-all
            ${current === opt.val ? `${opt.color} ${opt.activeText} shadow-lg shadow-black/20` : 'bg-white/5 text-gray-500 hover:bg-white/10'}
          `}
        >
          {opt.val}%
        </button>
      ))}
    </div>
  );
};

export const SubStageRow = ({ 
  subStage, 
  onEdit, 
  onDelete, 
  onUpdateProgress 
}: { 
  subStage: any, 
  onEdit: () => void, 
  onDelete: () => void,
  onUpdateProgress: (val: number) => void
}) => {
  const { scheduleItems, users, updateScheduleItem } = useData();
  const responsible = users.find(u => u.id === subStage.responsibleId);

  const formatDateToBR = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const statusInfo = getStatusInfo(subStage.status);

  return (
    <div className="grid grid-cols-[minmax(320px,2.2fr)_minmax(140px,0.9fr)_minmax(200px,1fr)_minmax(120px,0.7fr)_minmax(80px,0.5fr)] gap-[12px] p-3 bg-[#0B0E14]/30 rounded-lg border border-white/5 items-center hover:bg-white/5 transition-colors group">
      <div className="pl-4 border-l-2 border-[#F97316]/30 overflow-visible">
        <div 
          className="text-sm text-gray-300 font-medium leading-tight whitespace-nowrap overflow-visible text-clip cursor-help" 
          title={subStage.title}
        >
          {subStage.title}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {responsible && (
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
              Resp: {responsible.name}
            </span>
          )}
          {subStage.workFront && (
            <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/5 font-medium uppercase tracking-wider">
              Amb: {subStage.workFront}
            </span>
          )}
          {subStage.canExecuteParallel && (
            <span className="text-[10px] bg-[#F97316]/10 text-[#F97316] px-1.5 py-0.5 rounded border border-[#F97316]/20 font-medium uppercase tracking-wider flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v18"/><path d="M16 3v18"/></svg>
              Paralelo
            </span>
          )}
          {(subStage.dateLockedManual || subStage.durationManualEnabled) && (
            <span className="text-[10px] bg-[#F97316]/10 text-[#F97316] px-1.5 py-0.5 rounded border border-[#F97316]/20 font-medium uppercase tracking-wider">
              Manual
            </span>
          )}
        </div>
      </div>
      
      <div className="text-[11px] text-gray-400 flex flex-col gap-1 relative">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className={subStage.dateLockedManual ? "text-[#F97316]" : "text-[#F97316]/50"} />
          <InlineDateInput 
            value={subStage.startDate || ''} 
            onUpdate={async (date) => {
              await updateScheduleItem(subStage.id, { 
                manualStartDate: date, 
                startDateManual: true, 
                dateLockedManual: true 
              });
            }} 
          />
        </div>
        <div className="flex items-center gap-1.5 ml-4.5 opacity-60">
          <span className="font-medium mr-1">até</span>
          <InlineDateInput 
            value={subStage.endDate || ''} 
            onUpdate={async (date) => {
              await updateScheduleItem(subStage.id, { 
                manualEndDate: date, 
                endDateManual: true, 
                dateLockedManual: true 
              });
            }} 
          />
        </div>
        {subStage.dateLockedManual && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateScheduleItem(subStage.id, { 
                dateLockedManual: false,
                startDateManual: false,
                endDateManual: false,
                manualStartDate: undefined,
                manualEndDate: undefined
              });
            }}
            className="absolute -right-6 top-1/2 -translate-y-1/2 text-[9px] bg-white/10 hover:bg-[#F97316]/20 text-gray-400 hover:text-[#F97316] px-1.5 py-0.5 rounded transition-all"
            title="Voltar para cálculo automático"
          >
            Auto
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 py-1">
        {/* Bloco 1: Barra + % */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500" 
              style={{ width: `${subStage.progress}%`, ...getProgressStyle(subStage.progress) }} 
            />
          </div>
          <span className="text-[10px] font-black text-white min-w-[30px]">{subStage.progress}%</span>
        </div>
        {/* Bloco 2: Botões */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <QuickProgress current={subStage.progress} onUpdate={onUpdateProgress} size="sm" />
        </div>
      </div>

      <div className="text-center">
        <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase inline-block ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }} 
          className="p-2 text-gray-400 hover:text-[#F97316] hover:bg-white/5 rounded-lg transition-all"
          title="Editar"
        >
          <Edit2 size={16} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-white/5 rounded-lg transition-all"
          title="Excluir"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export const StageBlock = ({ 
  stage, 
  subStages, 
  onEdit, 
  onDelete, 
  onAddSubStage,
  onEditSubStage,
  onDeleteSubStage,
  onUpdateSubStageProgress
}: { 
  stage: any, 
  subStages: any[], 
  onEdit: () => void, 
  onDelete: () => void, 
  onAddSubStage: () => void,
  onEditSubStage: (subStage: any) => void,
  onDeleteSubStage: (subStageId: string) => void,
  onUpdateSubStageProgress: (subStageId: string, val: number) => void
}) => {
  const [expanded, setExpanded] = useState(true);
  const { updateScheduleItem, batchUpdateScheduleItems } = useData();

  const duration = stage.startDate && stage.endDate ? getDaysBetween(stage.startDate, stage.endDate) : 0;
  const [localDuration, setLocalDuration] = useState(duration);

  useEffect(() => {
    setLocalDuration(duration);
  }, [duration]);

  const handleDurationChange = (newDuration: number) => {
    if (isNaN(newDuration) || newDuration < 1) return;
    if (!stage.startDate) return;

    // Calculate new end date for the stage
    const newEnd = addDays(stage.startDate, newDuration - 1);
    
    const updates: { id: string; updates: any }[] = [
      {
        id: stage.id,
        updates: {
          endDate: newEnd,
          durationManual: newDuration,
          durationManualEnabled: true
        }
      }
    ];

    batchUpdateScheduleItems(updates);
  };

  const handleDurationBlur = () => {
    if (isNaN(localDuration) || localDuration < 1) {
      setLocalDuration(duration);
      return;
    }
    if (localDuration !== duration) {
      handleDurationChange(localDuration);
    }
  };

  return (
    <div className="mb-2 bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden shadow-lg shadow-black/20">
      <div 
        className="p-3 grid grid-cols-[minmax(320px,2.2fr)_minmax(140px,0.9fr)_minmax(200px,1fr)_minmax(120px,0.7fr)_minmax(80px,0.5fr)] gap-[12px] items-center cursor-pointer hover:bg-white/5 transition-colors" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 overflow-visible">
          <div className={`p-1.5 rounded-lg bg-white/5 text-gray-400 transition-transform duration-300 ${expanded ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown size={20} />
          </div>
          <div className="flex-1 min-w-0 overflow-visible">
            <h3 className="font-black text-white text-lg tracking-tight uppercase whitespace-nowrap overflow-visible text-clip">
              {stage.title}
              <span className="ml-2 text-sm text-gray-400 font-medium normal-case whitespace-nowrap flex items-center gap-2">
                — 
                <input 
                  type="number" 
                  value={localDuration} 
                  onChange={(e) => setLocalDuration(Number(e.target.value))}
                  onBlur={handleDurationBlur}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className={`w-12 bg-transparent border-b text-center text-white focus:outline-none focus:border-[#F97316] mx-1 ${stage.durationManualEnabled ? 'border-[#F97316] text-[#F97316]' : 'border-white/20'}`}
                />
                dias
                {stage.durationManualEnabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateScheduleItem(stage.id, { durationManualEnabled: false, durationManual: undefined });
                    }}
                    className="text-[9px] bg-white/10 hover:bg-[#F97316]/20 text-gray-400 hover:text-[#F97316] px-1.5 py-0.5 rounded transition-all ml-1"
                    title="Voltar para cálculo automático"
                  >
                    Auto
                  </button>
                )}
                {(stage.dateLockedManual || stage.durationManualEnabled) && (
                  <span className="text-[10px] bg-[#F97316]/10 text-[#F97316] px-1.5 py-0.5 rounded border border-[#F97316]/20 font-medium uppercase tracking-wider ml-2">
                    Manual
                  </span>
                )}
              </span>
            </h3>
          </div>
        </div>

        {/* Column 2: Empty (Period) */}
        <div />

        {/* Column 3: Progress */}
        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden relative">
              <div 
                className="h-full transition-all duration-500" 
                style={{ width: `${stage.progress}%`, ...getProgressStyle(stage.progress) }} 
              />
            </div>
            <span className="text-[10px] font-black text-white min-w-[40px] text-right">{stage.progress}%</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <QuickProgress current={stage.progress} onUpdate={(val) => onUpdateSubStageProgress(stage.id, val)} size="sm" />
          </div>
        </div>

        {/* Column 4: Status */}
        <div className="text-center">
          <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase inline-block ${getStatusInfo(stage.status).color}`}>
            {getStatusInfo(stage.status).label}
          </span>
        </div>

        {/* Column 5: Actions */}
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onAddSubStage(); }} 
            className="p-2.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all" 
            title="Adicionar Subetapa"
          >
            <Plus size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }} 
            className="p-2.5 text-gray-400 hover:text-[#F97316] hover:bg-[#F97316]/10 rounded-xl transition-all"
            title="Editar Etapa"
          >
            <Edit2 size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
            title="Excluir Etapa"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="p-3 bg-[#0B0E14]/40 border-t border-white/5 space-y-2">
          {subStages?.length > 0 ? (
            subStages.map(sub => (
              <SubStageRow 
                key={sub.id} 
                subStage={sub} 
                onEdit={() => onEditSubStage(sub)} 
                onDelete={() => onDeleteSubStage(sub.id)}
                onUpdateProgress={(val) => onUpdateSubStageProgress(sub.id, val)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-600 text-sm font-medium italic">
              Nenhuma subetapa cadastrada para esta etapa.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
