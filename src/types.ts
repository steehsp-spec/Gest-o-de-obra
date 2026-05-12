export interface Activity {
  id: string;
  obraId: string;
  userId: string;
  userName: string;
  type: 'create' | 'update' | 'delete' | 'comment';
  entity: 'obra' | 'tarefa' | 'transacao' | 'pendencia';
  entityId: string;
  description: string;
  timestamp: string;
}

export type TransactionCategory = 'material' | 'mao_de_obra' | 'equipamento' | 'servico' | 'administrativo' | 'outros';

export type UserRole = 'administrador' | 'engenheiro' | 'encarregado' | 'financeiro' | 'cliente';

export interface User {
  id: string; // Auth UID
  uid: string; // Duplicate for safety, must match id
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'ativo' | 'inativo';
  createdAt: string;
  updatedAt: string;
  password?: string;
}

export type ProjectStatus = 'planejamento' | 'em_execucao' | 'paralizada' | 'concluida' | 'atrasada';

export interface Obra {
  id: string;
  name: string;
  code?: string;
  client: string;
  phone?: string;
  address?: string;
  city?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  managerId?: string;
  budget: number;
  status: ProjectStatus;
  description?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  tipoCronograma?: 'automatico' | 'duracao' | 'manual' | 'em_branco';
  estruturaCronograma?: any;
}

export interface Responsavel {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  status: 'ativo' | 'inativo';
  createdAt: string;
  updatedAt: string;
}

export type Priority = 'baixa' | 'media' | 'alta' | 'critica';
export type PendencyStatus = 'aberta' | 'em_andamento' | 'resolvida' | 'cancelada' | 'em_analise';

export interface Pendencia {
  id: string;
  title: string;
  description: string;
  obraId: string;
  tarefaId?: string; // New name
  scheduleItemId?: string; // Legacy alias
  origin?: string;
  responsibleId: string;
  priority: Priority;
  deadline: string;
  status: PendencyStatus;
  createdAt: string;
  updatedAt: string;
  stage?: string;
  finalObservation?: string;
}

export type Complexity = 'baixa' | 'media' | 'alta';

export interface Tarefa {
  id: string;
  obraId: string;
  parentStepId?: string;
  title: string;
  ordem: number;
  ordem_etapa?: number;
  ordem_subitem?: number;
  responsavelUserId?: string;
  responsibleId?: string; // Legacy/UI alias
  responsavelNome?: string;
  startDate: string;
  endDate: string;
  progress: number;
  weight: number;
  complexity?: Complexity;
  realWeight?: number;
  responsavelTipo?: 'usuario' | 'manual';
  status: 'pendente' | 'em_processo' | 'revisao' | 'finalizando' | 'concluido' | 'atrasado' | 'em_andamento';
  createdAt: string;
  updatedAt: string;
  duration?: number;
  description?: string;
  notes?: string;
  workFront?: string;
  // Field for automatic calculation
  dependsOnId?: string;
  dependsOnIds?: string[];
  dependencyType?: 'bloqueante' | 'paralela' | 'flexivel';
  linkType?: string; 
  canExecuteParallel?: boolean;
  // Manual overrides
  dateLockedManual?: boolean;
  startDateManual?: boolean;
  endDateManual?: boolean;
  manualStartDate?: string;
  manualEndDate?: string;
  durationManual?: number;
  durationManualEnabled?: boolean;
  manualDays?: number;
  // Template metadata
  templateStepId?: string;
  templateSubStepId?: string;
  activityType?: string;
  baseDurationDays?: number;
}

export type TransactionType = 'entrada' | 'saida';

export interface Transacao {
  id: string;
  obraId: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'confirmado';
  createdAt: string;
  updatedAt: string;
  // Professional/Labor fields
  workedHours?: number;
  workedDays?: number;
  dailyRateValue?: number;
  payableHours?: number;
  fullDailyRates?: number;
  adjustedDailyRates?: number;
  totalDailyRates?: number;
}

export interface TemplateSubStep {
  id: string;
  title: string;
  ordem?: number;
}

export interface TemplateStep {
  id: string;
  title: string;
  ordem: number;
  weight: number; 
  subSteps: TemplateSubStep[];
  selected: boolean;
  selectedSubSteps: Record<string, boolean>; 
  subStepComplexities?: Record<string, Complexity>;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  type: 'obra_completa' | 'obra_parcial' | 'manutencao' | 'em_branco' | 'personalizado';
  structure: TemplateStep[];
  updatedAt: string;
}

export interface Settings {
  companyName: string;
  cnpj?: string;
  phone: string;
  email: string;
  address: string;
  responsible: string;
  logoUrl?: string;
  primaryColor: string;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
  language?: string;
  projectTemplates?: {
    completa: TemplateStep[];
    parcial: TemplateStep[];
  };
}

// Aliases for transition
export type Project = Obra;
export type Transaction = Transacao;
export type ScheduleItem = Tarefa;
export type Pendency = Pendencia;
