export type UserRole = 'administrador' | 'engenheiro' | 'encarregado' | 'financeiro' | 'cliente';

export interface User {
  id: string; // This will be the Firebase UID
  uid?: string; // Redundant but good for clarity as requested
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'ativo' | 'inativo';
  password?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectStatus = 'planejamento' | 'em_execucao' | 'paralizada' | 'concluida' | 'atrasada';

export interface Project {
  id: string;
  name: string;
  code: string;
  client: string;
  phone: string;
  address: string;
  city: string;
  startDate: string;
  endDate: string;
  totalDays?: number;
  managerId: string; // User ID
  budget: number;
  status: ProjectStatus;
  description: string;
  tipoCronograma?: 'em_branco' | 'obra_completa' | 'obra_parcial' | 'manutencao';
  estruturaCronograma?: TemplateStep[];
  progress: number;
  location?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  type: 'obra_completa' | 'obra_parcial' | 'manutencao' | 'em_branco' | 'personalizado';
  structure: TemplateStep[];
  updatedAt?: string;
}

export type Priority = 'baixa' | 'media' | 'alta' | 'critica';
export type PendencyStatus = 'aberta' | 'em_andamento' | 'resolvida' | 'cancelada';

export interface Pendency {
  id: string;
  title: string;
  description: string;
  projectId: string;
  stage: string; // Keep for backward compatibility or general stage
  scheduleItemId?: string; // Link to specific schedule item
  origin?: 'cronograma' | 'outro';
  responsibleId: string;
  priority: Priority;
  deadline: string;
  status: PendencyStatus;
  finalObservation?: string;
}

export type ActivityStatus = 'a_fazer' | 'em_andamento' | 'revisao' | 'finalizando' | 'concluido';

export interface Activity {
  id: string;
  name: string;
  projectId: string;
  stage: string;
  responsibleId: string;
  startDate: string;
  endDate: string;
  priority: Priority;
  progress: number; // 0-100
  status: ActivityStatus;
  observation?: string;
}

export type Complexity = 'baixa' | 'media' | 'alta';

export interface ScheduleItem {
  id: string;
  projectId: string;
  parentStepId?: string; // If null, it's a main step
  templateStepId?: string; // Link to TemplateStep.id
  templateSubStepId?: string; // Link to TemplateSubStep.id
  title: string;
  ordem: number;
  ordem_etapa?: number;
  ordem_subitem?: number;
  responsibleId?: string; // Mantido para compatibilidade
  responsavelTipo?: 'usuario' | 'manual';
  responsavelUserId?: string;
  responsavelNome?: string;
  startDate?: string;
  endDate?: string;
  progress: number;
  weight: number; // For main steps: % of project (0-100). For sub-steps: complexity weight (1, 2, 3)
  complexity?: Complexity; // Only for sub-steps
  realWeight?: number; // Calculated: weight in the total project (0-100)
  status: 'pendente' | 'em_andamento' | 'em_processo' | 'revisao' | 'finalizando' | 'concluido' | 'atrasado';
  dependsOnId?: string; // ID of another ScheduleItem in the same project (deprecated, use dependsOnIds)
  dependsOnIds?: string[]; // Multiple dependencies
  followScheduleOrder?: boolean; // If true, depends on the previous item in the list
  workFront?: string;
  startDateManual?: boolean;
  endDateManual?: boolean;
  baseDurationDays?: number;
  liberatingActivityId?: string;
  linkType?: 'FS' | 'SS'; // FS: Finish-to-Start, SS: Start-to-Start
  dateLockedManual?: boolean;
  activityType?: string;
  durationManual?: number;
  durationManualEnabled?: boolean;
  manualStartDate?: string;
  manualEndDate?: string;
  manualDays?: number;
  manualProgress?: number;
}

export type TransactionType = 'entrada' | 'saida';
export type TransactionCategory = 'materiais' | 'mao_de_obra' | 'equipamentos' | 'administrativo' | 'impostos' | 'recebimento' | 'outros';

export interface Transaction {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: string;
  status: 'pendente' | 'pago' | 'atrasado';
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
  weight: number; // % of project
  subSteps: TemplateSubStep[];
  selected: boolean;
  selectedSubSteps: Record<string, boolean>; // Key is subStep.id
  subStepComplexities?: Record<string, Complexity>; // Key is subStep.id
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
