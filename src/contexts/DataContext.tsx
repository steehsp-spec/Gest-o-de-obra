import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser as deleteAuthUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Project, Pendency, Activity, ScheduleItem, Transaction, Settings, ProjectTemplate, Complexity } from '../types';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { OBRA_COMPLETA_TEMPLATE, OBRA_PARCIAL_TEMPLATE, OBRA_MANUTENCAO_TEMPLATE } from '../utils/projectTemplates';
import { parseDateStr, addDays, getDaysBetween } from '../utils/dateUtils';

interface DataContextType {
  users: User[];
  projects: Project[];
  projectTemplates: ProjectTemplate[];
  pendencies: Pendency[];
  activities: Activity[];
  scheduleItems: ScheduleItem[];
  transactions: Transaction[];
  settings: Settings;
  isMigrated: boolean;
  isMigrating: boolean;
  migrationLog: string[];
  dataStatus: {
    source: 'local' | 'firestore';
    counts: Record<string, number>;
  };
  
  // CRUD Operations
  addUser: (user: Omit<User, 'id' | 'uid'> & { password?: string }) => Promise<string>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  
  addProject: (project: Omit<Project, 'id'>) => Promise<string>;
  updateProject: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  updateProjectTemplate: (id: string, template: Partial<ProjectTemplate>) => Promise<void>;
  addProjectTemplate: (template: Omit<ProjectTemplate, 'id'>) => Promise<string>;
  deleteProjectTemplate: (id: string) => Promise<void>;
  
  addPendency: (pendency: Omit<Pendency, 'id'>) => Promise<void>;
  updatePendency: (id: string, pendency: Partial<Pendency>) => Promise<void>;
  deletePendency: (id: string) => Promise<void>;
  
  addActivity: (activity: Omit<Activity, 'id'>) => Promise<void>;
  updateActivity: (id: string, activity: Partial<Activity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  
  addScheduleItem: (item: Omit<ScheduleItem, 'id'>) => Promise<string>;
  updateScheduleItem: (id: string, item: Partial<ScheduleItem>) => Promise<void>;
  deleteScheduleItem: (id: string) => Promise<void>;
  batchUpdateScheduleItems: (items: { id: string, updates: Partial<ScheduleItem> }[]) => Promise<void>;
  generateAutomaticSchedule: (projectId: string, startDate: string) => Promise<void>;
  generateScheduleByDuration: (
    projectId: string,
    startDate: string,
    totalDays: number,
    complexity: Complexity,
    weights: {
      demolicao: number;
      civil: number;
      eletrica: number;
      hidraulica: number;
      gesso: number;
      exaustao: number;
      incendio: number;
      acabamento: number;
    }
  ) => Promise<ScheduleItem[]>;
  
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  migrateToFirestore: () => Promise<void>;
  recalculateAll: (projectId?: string, stageId?: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  
  // Backup & Restore
  exportBackup: () => Promise<void>;
  exportEmptyTemplate: () => void;
  importBackup: (file: File, mode: 'merge' | 'replace') => Promise<{ success: boolean; summary?: any; error?: string }>;
  isImporting: boolean;
  
  // Auth
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_KEY = 'aer_engenharia_data';

const initialSettings: Settings = {
  companyName: 'A&R Engenharia',
  cnpj: '',
  phone: '(11) 99999-9999',
  email: 'contato@areng.com',
  address: 'Av. Paulista, 1000 - São Paulo, SP',
  responsible: 'Pedro Henrique',
  primaryColor: '#F97316',
  notificationsEnabled: true,
  theme: 'dark',
  language: 'pt-BR'
};

export const BASE_DURATIONS: Record<string, number> = {
  // DEMOLIÇÃO
  'demolicao_simples': 2,
  'demolicao_forro': 2,
  'demolicao_parede': 3,
  
  // CONTRA PISO / AZULEJO / ALVENARIA
  'elevacao_alvenaria': 3,
  'assentamento_ceramica': 2,
  'assentamento_pastilhas': 2,
  'rejunte': 1,
  'granito': 2,
  'cantoneira': 1,
  'preparacao_parede': 2,
  
  // GESSO / PAREDE / FORRO
  'gesso_base': 2,
  'fechamento_parede': 2,
  'fechamento_forro': 2,
  
  // HIDRÁULICA
  'hidraulica_base': 2,
  'hidraulica_revisao': 1,
  'hidraulica_tubulacao': 2,
  'hidraulica_instalacao_final': 2,
  
  // EXAUSTÃO / VENTILAÇÃO / AR-CONDICIONADO
  'coifa': 3,
  'grelhas': 2,
  
  // SISTEMA DE COMBATE AO INCÊNDIO
  'incendio_revisao': 1,
  'incendio_instalacao': 2,
  'incendio_testes': 1,
  
  // ELÉTRICA
  'eletrica_infra': 2,
  'eletrica_cabeamento': 2,
  'eletrica_rabicho': 1,
  'eletrica_iluminacao': 2,
  'eletrica_instalacao': 2,
  'eletrica_quadro': 2,
  'eletrica_testes': 1,
  
  // ACABAMENTO
  'acabamento_preparacao': 2,
  'acabamento_pintura': 3,
  'acabamento_final': 2,
  
  'outros': 1,
};

export const DEFAULT_STAGE_WEIGHTS: Record<string, number> = {
  'demolicao': 5,
  'civil': 30,
  'eletrica': 15,
  'hidraulica': 15,
  'gesso': 10,
  'exaustao': 5,
  'incendio': 5,
  'acabamento': 15
};

export const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  baixa: 1.0,
  media: 2.0,
  alta: 3.0,
};

const getSequenceScore = (stageId: string, weight: number, itemCount?: number) => {
  const baseScores: Record<string, number> = {
    'demolicao': 10,
    'civil': 20,
    'hidraulica': 30,
    'exaustao': 40,
    'incendio': 50,
    'gesso': 60,
    'eletrica': 70,
    'acabamento': 80
  };

  let score = baseScores[stageId] || 99;

  // Rule: Exaustão vs Elétrica (Interference)
  if (stageId === 'exaustao') {
    // If Exaustão is small (low weight or few items), it can move after Elétrica
    if (weight < 5 || (itemCount !== undefined && itemCount < 3)) {
      score = 75; // After Elétrica (70)
    }
  }

  if (stageId === 'eletrica') {
    // If Elétrica is large (high impact), it can start earlier
    if (weight > 15 || (itemCount !== undefined && itemCount > 10)) {
      score = 35; // Move before Exaustão/Incendio
    }
  }

  // Rule: Hidráulica (Impact)
  if (stageId === 'hidraulica') {
    // If Hidráulica is very large, it's high impact, keep it early or move even earlier
    if (weight > 20 || (itemCount !== undefined && itemCount > 15)) {
      score = 15; // Move before Civil (20)
    }
    // If Hidráulica is small, it can move after Exaustão
    if (weight < 5 || (itemCount !== undefined && itemCount < 3)) {
      score = 45; 
    }
  }

  // Rule: Gesso (Dependencies)
  if (stageId === 'gesso') {
    // If Gesso is small, it can move later (closer to finishing)
    if (weight < 5 || (itemCount !== undefined && itemCount < 3)) {
      score = 78; // Just before Acabamento (80)
    }
    // If Gesso is large, it might need to start earlier (but still after heavy infra)
    if (weight > 15 || (itemCount !== undefined && itemCount > 10)) {
      score = 55; // Move before original gesso 60
    }
  }

  return score;
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Load data from localStorage or use defaults
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  
  const [isMigrated, setIsMigrated] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [dataStatus, setDataStatus] = useState<{ source: 'local' | 'firestore', counts: Record<string, number> }>({
    source: 'local',
    counts: {}
  });
  const [isFirestoreReady, setIsFirestoreReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError(errInfo.error);
    return errInfo;
  };

  // Migration logic
  const migrateToFirestore = async () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : null;
    if (!data) {
      console.log('Nenhum dado encontrado no localStorage para migração.');
      return;
    }

    // Check if there's actually something to migrate
    const hasLocalData = Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0);
    if (!hasLocalData) {
      console.log('LocalStorage existe mas está vazio de dados relevantes.');
      return;
    }

    console.log('Iniciando migração segura do localStorage para o Firestore...');
    setIsMigrating(true);
    const logs: string[] = [];
    
    try {
      // Use batches for efficiency
      const batch = writeBatch(db);
      
      // Migrate Settings
      if (data.settings) {
        batch.set(doc(db, 'settings', 'global'), cleanData(data.settings));
        logs.push('Configurações globais migradas.');
      }

      // Migrate Collections
      const collections = [
        { key: 'users', path: 'users', label: 'Usuários' },
        { key: 'projects', path: 'projects', label: 'Projetos' },
        { key: 'pendencies', path: 'pendencies', label: 'Pendências' },
        { key: 'activities', path: 'activities', label: 'Atividades' },
        { key: 'scheduleItems', path: 'scheduleItems', label: 'Cronograma' },
        { key: 'transactions', path: 'transactions', label: 'Financeiro' }
      ];

      for (const col of collections) {
        const items = data[col.key] || [];
        if (items.length > 0) {
          items.forEach((item: any) => {
            const itemRef = doc(db, col.path, item.id);
            batch.set(itemRef, cleanData(item));
          });
          logs.push(`${items.length} ${col.label} migrados.`);
        }
      }

      await batch.commit();
      console.log('Migração concluída com sucesso.');
      setMigrationLog(logs);
      setIsMigrated(true);
    } catch (err) {
      console.error('Erro durante a migração:', err);
    } finally {
      setIsMigrating(false);
    }
  };

  // Backup & Restore Implementation
  const exportBackup = async () => {
    try {
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          users,
          projects,
          pendencies,
          activities,
          scheduleItems,
          transactions,
          settings
        }
      };

      const date = new Date();
      const timestamp = date.toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
      const filename = `backup-obra-${timestamp}.json`;

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Backup exportado com sucesso: ${filename}`);
    } catch (err) {
      console.error('Erro ao exportar backup:', err);
      throw err;
    }
  };

  const exportEmptyTemplate = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        users: [],
        projects: [],
        pendencies: [],
        activities: [],
        scheduleItems: [],
        transactions: [],
        settings: initialSettings
      }
    };

    const filename = `modelo-backup-vazio.json`;
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File, mode: 'merge' | 'replace'): Promise<{ success: boolean; summary?: any; error?: string }> => {
    setIsImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Basic validation
      if (!backup.version || !backup.data) {
        throw new Error('Formato de backup inválido: Versão ou dados ausentes.');
      }

      const { data } = backup;
      const summary = {
        users: data.users?.length || 0,
        projects: data.projects?.length || 0,
        pendencies: data.pendencies?.length || 0,
        activities: data.activities?.length || 0,
        scheduleItems: data.scheduleItems?.length || 0,
        transactions: data.transactions?.length || 0
      };

      if (dataStatus.source === 'firestore') {
        const batch = writeBatch(db);

        if (mode === 'replace') {
          // In Firestore, "replace" is tricky because we can't easily clear collections from client
          // We will at least overwrite existing IDs and add new ones
          const collections = ['users', 'projects', 'pendencies', 'activities', 'scheduleItems', 'transactions'];
          
          // Overwrite/Set settings
          if (data.settings) {
            batch.set(doc(db, 'settings', 'global'), cleanData(data.settings));
          }

          // Set all data from backup
          for (const col of collections) {
            const items = data[col] || [];
            items.forEach((item: any) => {
              batch.set(doc(db, col, item.id), cleanData(item));
            });
          }
        } else {
          // Merge mode: only set if not exists or update
          if (data.settings) {
            batch.set(doc(db, 'settings', 'global'), cleanData(data.settings), { merge: true });
          }

          const collections = ['users', 'projects', 'pendencies', 'activities', 'scheduleItems', 'transactions'];
          for (const col of collections) {
            const items = data[col] || [];
            items.forEach((item: any) => {
              batch.set(doc(db, col, item.id), cleanData(item), { merge: true });
            });
          }
        }

        await batch.commit();
        
        // Recalcular tudo após a importação para garantir consistência
        setTimeout(() => {
          recalculateAll();
        }, 2000); // Pequeno delay para garantir que os listeners do Firestore processaram os novos dados
      } else {
        // LocalStorage mode
        if (mode === 'replace') {
          const newData = {
            users: data.users || [],
            projects: data.projects || [],
            pendencies: data.pendencies || [],
            activities: data.activities || [],
            scheduleItems: data.scheduleItems || [],
            transactions: data.transactions || [],
            settings: data.settings || settings
          };
          
          setUsers(newData.users);
          setProjects(newData.projects);
          setPendencies(newData.pendencies);
          setActivities(newData.activities);
          setScheduleItems(recalculateSchedule(newData.scheduleItems));
          setTransactions(newData.transactions);
          setSettings(newData.settings);
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        } else {
          // Merge LocalStorage
          const saved = localStorage.getItem(STORAGE_KEY);
          const currentData = (saved ? JSON.parse(saved) : null) || {
            users: [], projects: [], pendencies: [], activities: [], scheduleItems: [], transactions: [], settings
          };

          const merge = (current: any[], incoming: any[]) => {
            const merged = [...current];
            incoming.forEach(item => {
              const index = merged.findIndex(i => i.id === item.id);
              if (index >= 0) {
                merged[index] = item;
              } else {
                merged.push(item);
              }
            });
            return merged;
          };

          const newData = {
            users: merge(currentData.users, data.users || []),
            projects: merge(currentData.projects, data.projects || []),
            pendencies: merge(currentData.pendencies, data.pendencies || []),
            activities: merge(currentData.activities, data.activities || []),
            scheduleItems: merge(currentData.scheduleItems, data.scheduleItems || []),
            transactions: merge(currentData.transactions, data.transactions || []),
            settings: data.settings || currentData.settings
          };

          setUsers(newData.users);
          setProjects(newData.projects);
          setPendencies(newData.pendencies);
          setActivities(newData.activities);
          setScheduleItems(recalculateSchedule(newData.scheduleItems));
          setTransactions(newData.transactions);
          setSettings(newData.settings);

          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
      }

      return { success: true, summary };
    } catch (err: any) {
      console.error('Erro ao importar backup:', err);
      return { success: false, error: err.message || 'Erro desconhecido ao processar arquivo.' };
    } finally {
      setIsImporting(false);
    }
  };

  // Data Audit Effect
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : null;
    const counts = {
      users: data?.users?.length || 0,
      projects: data?.projects?.length || 0,
      pendencies: data?.pendencies?.length || 0,
      activities: data?.activities?.length || 0,
      scheduleItems: data?.scheduleItems?.length || 0,
      transactions: data?.transactions?.length || 0
    };
    
    console.log('--- AUDITORIA DE DADOS (LOCAL) ---');
    console.log('Dados encontrados no localStorage:', counts);
    console.log('----------------------------------');
    
    setDataStatus(prev => ({ ...prev, counts }));
  }, []);

  // Update data status when state changes
  useEffect(() => {
    const counts = {
      users: users.length,
      projects: projects.length,
      pendencies: pendencies.length,
      activities: activities.length,
      scheduleItems: scheduleItems.length,
      transactions: transactions.length
    };
    
    // Source is firestore only if we have received at least one snapshot from firestore
    // and that snapshot wasn't empty, OR if we just completed a migration
    const source = isFirestoreReady ? 'firestore' : 'local';
    
    setDataStatus({ source, counts });
  }, [users, projects, pendencies, activities, scheduleItems, transactions, currentUser, isFirestoreReady]);

  // Auth session management
  useEffect(() => {
    console.log('Iniciando listener de estado de autenticação...');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('Usuário detectado no Auth:', { uid: firebaseUser.uid, email: firebaseUser.email });
        
        // Trigger migration check when admin logs in
        if (firebaseUser.email === 'alessandro.aerengenharia2@gmail.com') {
          migrateToFirestore();
        }

        try {
          const userPath = `users/${firebaseUser.uid}`;
          console.log('Buscando perfil no Firestore em:', userPath);
          
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('Perfil encontrado:', userData);
            
            if (userData.status === 'inativo') {
              console.warn('Usuário inativo. Fazendo logout.');
              await signOut(auth);
              setCurrentUser(null);
              setError('Usuário inativo. Procure o administrador.');
            } else {
              setCurrentUser({ ...userData, id: firebaseUser.uid, uid: firebaseUser.uid });
              setError(null);
            }
          } else {
            console.warn('Perfil não encontrado para o UID:', firebaseUser.uid);
            
            // Criar perfil automático se não existir (para usuários criados via console ou legados)
            const newProfile: User = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Novo Usuário',
              email: firebaseUser.email || '',
              phone: '',
              role: firebaseUser.email === 'alessandro.aerengenharia2@gmail.com' ? 'administrador' : 'encarregado',
              status: 'ativo',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            console.log('Criando perfil automático para o usuário...');
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              console.log('Perfil automático criado com sucesso.');
              setCurrentUser(newProfile);
              setError(null);
            } catch (createErr) {
              console.error('Erro ao criar perfil automático:', createErr);
              setError('Perfil do usuário não encontrado e não pôde ser criado.');
              await signOut(auth);
              setCurrentUser(null);
            }
          }
        } catch (err) {
          console.error('Erro ao buscar perfil do usuário no listener:', err);
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          await signOut(auth);
          setCurrentUser(null);
        }
      } else {
        console.log('Nenhum usuário autenticado.');
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      console.log('Iniciando login para:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log('Autenticado no Firebase Auth com UID:', firebaseUser.uid);

      const userPath = `users/${firebaseUser.uid}`;
      console.log('Buscando perfil no Firestore em:', userPath);
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        console.log('Perfil encontrado no Firestore:', userData);
        
        if (userData.status === 'inativo') {
          console.warn('Login bloqueado: Usuário inativo.');
          await signOut(auth);
          setError('Usuário inativo. Procure o administrador.');
          setLoading(false);
          return false;
        }
        
        setCurrentUser({ ...userData, id: firebaseUser.uid, uid: firebaseUser.uid });
        setLoading(false);
        return true;
      } else {
        console.warn('Perfil não encontrado para UID:', firebaseUser.uid);
        
        // Tentar criar perfil automático no login também
        const newProfile: User = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || email.split('@')[0] || 'Novo Usuário',
          email: email,
          phone: '',
          role: email === 'steeh.sp@gmail.com' || email === 'alessandro.aerengenharia2@gmail.com' ? 'administrador' : 'encarregado',
          status: 'ativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        try {
          console.log('Criando perfil automático no login...');
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          console.log('Perfil automático criado com sucesso.');
          setCurrentUser(newProfile);
          setLoading(false);
          return true;
        } catch (createErr) {
          console.error('Erro ao criar perfil automático no login:', createErr);
          await signOut(auth);
          setError('Perfil do usuário não encontrado no sistema.');
          setLoading(false);
          return false;
        }
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      setLoading(false);
      
      if (err.code === 'auth/user-not-found') {
        setError('Usuário não encontrado.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Senha incorreta.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão com o Firebase. Isso pode ocorrer em apps "Remixados" que precisam de uma nova configuração de backend. Por favor, clique no botão de configuração do Firebase se disponível ou verifique sua internet.');
      } else if (err.code === 'permission-denied') {
        setError('Erro de permissão ao acessar o perfil no banco de dados.');
      } else {
        setError('Erro ao autenticar. Verifique sua conexão e tente novamente.');
      }
      return false;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setError(null);
    setLoading(true);
    try {
      console.log('Iniciando registro para:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log('Usuário criado no Firebase Auth com UID:', firebaseUser.uid);

      const newProfile: User = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        name: name || email.split('@')[0],
        email: email,
        phone: '',
        role: email === 'steeh.sp@gmail.com' || email === 'alessandro.aerengenharia2@gmail.com' ? 'administrador' : 'encarregado',
        status: 'ativo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Criando perfil no Firestore...');
      await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
      console.log('Perfil criado com sucesso.');
      
      setCurrentUser(newProfile);
      setLoading(false);
      return true;
    } catch (err: any) {
      console.error('Erro no registro:', err);
      setLoading(false);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha é muito fraca.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão com o Firebase. Verifique sua internet.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
      return false;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  // Helper to recalculate weights, progress and dates
  const calculateDuration = (item: ScheduleItem, totalDays?: number) => {
    // 1. Se a duração manual estiver habilitada (pelo usuário), usa ela
    if (item.durationManualEnabled && item.durationManual !== undefined) {
      return Math.max(1, item.durationManual);
    }
    
    // 1. Se tiver duração manual habilitada, usa ela
    if (item.durationManualEnabled) {
      if (item.manualDays !== undefined) return Math.max(1, item.manualDays);
      if (item.durationManual !== undefined) return Math.max(1, item.durationManual);
    }
    
    // 2. Se tiver dias manuais definidos (legado), usa eles
    if (item.manualDays !== undefined) {
      return Math.max(1, item.manualDays);
    }

    // 3. Se tiver duração automática calculada pela distribuição coletiva, usa ela
    if (item.durationManual !== undefined) {
      return Math.max(1, item.durationManual);
    }

    // 4. Fallback: Se tiver peso real e prazo total, calcula proporcionalmente
    // O peso real já deve considerar a complexidade e o peso da etapa
    if (totalDays && item.realWeight && item.realWeight > 0) {
      const duration = (totalDays * (item.realWeight / 100));
      return Math.max(1, Math.ceil(duration));
    }
    
    const base = item.baseDurationDays || (item.activityType ? BASE_DURATIONS[item.activityType] : 0) || 1;
    const multiplier = item.complexity === 'baixa' ? 1 : (item.complexity === 'alta' ? 3 : 2);
    return Math.ceil(base * (multiplier / 2));
  };

  const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = (year: number, month: number) => {
    return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  };

  const addDays = (dateStr: string, days: number): string => {
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let d = parseInt(parts[2], 10);
    
    if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

    d += days;
    
    while (d > daysInMonth(y, m)) {
      d -= daysInMonth(y, m);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    
    while (d <= 0) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      d += daysInMonth(y, m);
    }
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  const compareDates = (date1: string | null | undefined, date2: string | null | undefined): number => {
    if (!date1 && !date2) return 0;
    if (!date1) return -1;
    if (!date2) return 1;
    return date1.localeCompare(date2);
  };

  const recalculateSchedule = (items: ScheduleItem[], projectId?: string, stageId?: string, updatedProject?: Project, forceFullRecalculate?: boolean) => {
    // Create a deep-ish copy to avoid mutating the original state objects
    const updatedItems = items.map(item => ({ ...item }));
    const projectIds = projectId ? [projectId] : Array.from(new Set(updatedItems.map(i => i.projectId)));

    const parseDateStr = (dateStr: string | undefined | null): string | null => {
      if (!dateStr || typeof dateStr !== 'string' || dateStr === 'undefined' || dateStr === 'null') return null;
      return dateStr;
    };

    projectIds.forEach(pId => {
      const project = (updatedProject && updatedProject.id === pId) ? updatedProject : projects.find(p => p.id === pId);
      if (!project) return;
      
      const totalDays = project.totalDays || 0;
      const projectItems = updatedItems.filter(i => i.projectId === pId);
      const mainSteps = projectItems.filter(i => !i.parentStepId).sort((a, b) => a.ordem - b.ordem);

      // Se for um recálculo forçado (mudança no projeto), resetamos apenas as travas de data, mas mantemos as durações manuais se possível
      if (forceFullRecalculate) {
        console.log(`[Recalculate] Resetando travas de data para o projeto ${pId} devido a recálculo forçado.`);
        projectItems.forEach(item => {
          const itemIndex = updatedItems.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            // Mantemos durationManualEnabled para respeitar a vontade do usuário de fixar um prazo
            updatedItems[itemIndex].startDateManual = false;
            updatedItems[itemIndex].endDateManual = false;
            updatedItems[itemIndex].dateLockedManual = false;
            updatedItems[itemIndex].manualStartDate = undefined;
            updatedItems[itemIndex].manualEndDate = undefined;
            // manualDays e durationManual são mantidos se durationManualEnabled for true
          }
        });
      }

      // 0. Recalcular pesos e durações automáticas
      
      // 0.1. Distribuir dias entre etapas principais (se não houver stageId específico)
      if (!stageId && totalDays > 0) {
        // Identificar etapas com duração manual e subtrair do total
        const manualMainSteps = mainSteps.filter(s => s.durationManualEnabled && s.durationManual !== undefined);
        
        // "Aprender" com os dados manuais: atualizar pesos baseados na proporção real
        manualMainSteps.forEach(step => {
          const itemIndex = updatedItems.findIndex(i => i.id === step.id);
          if (itemIndex !== -1) {
            // Nenhuma etapa pode ultrapassar o total da obra
            if ((updatedItems[itemIndex].durationManual || 0) > totalDays) {
              updatedItems[itemIndex].durationManual = totalDays;
            }
            // Atualizar peso para refletir a proporção manual
            const newWeight = ((updatedItems[itemIndex].durationManual || 0) / totalDays) * 100;
            updatedItems[itemIndex].weight = Number(newWeight.toFixed(2));
          }
        });

        const manualDays = manualMainSteps.reduce((acc, s) => acc + (s.durationManual || 0), 0);
        const remainingDays = Math.max(0, totalDays - manualDays);
        const autoMainSteps = mainSteps.filter(s => !s.durationManualEnabled);
        const totalAutoWeight = autoMainSteps.reduce((acc, s) => acc + (s.weight || 0), 0);

        if (totalAutoWeight > 0) {
          let allocatedAutoDays = 0;
          autoMainSteps.forEach((step, idx) => {
            const itemIndex = updatedItems.findIndex(i => i.id === step.id);
            if (itemIndex === -1) return;
            
            let duration = 0;
            if (idx === autoMainSteps.length - 1) {
              duration = Math.max(1, remainingDays - allocatedAutoDays);
            } else {
              duration = Math.max(1, Math.round(remainingDays * (step.weight / totalAutoWeight)));
            }
            allocatedAutoDays += duration;
            updatedItems[itemIndex].durationManual = duration;
          });
        }
      }

      // 0.2. Calcular pesos reais das subetapas
      mainSteps.forEach(mainStep => {
        // Garantir que a etapa principal tenha seu realWeight (que é o seu próprio peso %)
        const mainStepIndex = updatedItems.findIndex(i => i.id === mainStep.id);
        if (mainStepIndex !== -1) {
          // Se o peso for 0 ou indefinido, tenta buscar um peso padrão baseado no título
          if (!updatedItems[mainStepIndex].weight || updatedItems[mainStepIndex].weight === 0) {
            const title = updatedItems[mainStepIndex].title.toLowerCase();
            let defaultWeight = 10; // Default fallback
            for (const [key, value] of Object.entries(DEFAULT_STAGE_WEIGHTS)) {
              if (title.includes(key)) {
                defaultWeight = value;
                break;
              }
            }
            updatedItems[mainStepIndex].weight = defaultWeight;
          }
          updatedItems[mainStepIndex].realWeight = updatedItems[mainStepIndex].weight || 0;
        }

        const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id).sort((a, b) => a.ordem - b.ordem);
        if (subSteps.length > 0) {
          const totalComplexityWeight = subSteps.reduce((acc, sub) => acc + (sub.weight || 1), 0);
          
          subSteps.forEach(sub => {
            const subIndex = updatedItems.findIndex(i => i.id === sub.id);
            if (subIndex !== -1) {
              const complexityWeight = sub.weight || 1;
              const parentWeight = updatedItems[mainStepIndex].weight || 0;
              const realWeight = parentWeight * (complexityWeight / (totalComplexityWeight || 1));
              updatedItems[subIndex].realWeight = Number(realWeight.toFixed(2));
            }
          });
        }
      });

      // 0.3. Distribuir dias entre subetapas dentro de cada etapa
      mainSteps.forEach(mainStep => {
        const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id).sort((a, b) => a.ordem - b.ordem);
        if (subSteps.length > 0) {
          const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
          const stageDuration = updatedItems[mainIndex].durationManual || 1;
          
          // Identificar subetapas com duração manual e subtrair da duração da etapa
          const manualSubSteps = subSteps.filter(s => s.durationManualEnabled && s.durationManual !== undefined);
          
          // "Aprender" com os dados manuais das subetapas
          manualSubSteps.forEach(sub => {
            const subIndex = updatedItems.findIndex(i => i.id === sub.id);
            if (subIndex !== -1) {
              // Garantir que subetapas manuais não ultrapassem a etapa
              if ((updatedItems[subIndex].durationManual || 0) > stageDuration) {
                updatedItems[subIndex].durationManual = stageDuration;
              }
              // Atualizar peso relativo da subetapa dentro da etapa pai
              const newSubWeight = ((updatedItems[subIndex].durationManual || 0) / stageDuration) * (mainStep.weight || 10);
              updatedItems[subIndex].weight = Number(newSubWeight.toFixed(2));
            }
          });

          const manualSubDays = manualSubSteps.reduce((acc, s) => acc + (s.durationManual || 0), 0);
          const remainingSubDays = Math.max(0, stageDuration - manualSubDays);
          const autoSubSteps = subSteps.filter(s => !s.durationManualEnabled);
          
          const subStepDurationWeights = autoSubSteps.map(sub => {
            // Distribuímos a duração da etapa proporcionalmente ao realWeight
            return (sub.realWeight || 0);
          });
          
          const totalSubDurationWeight = subStepDurationWeights.reduce((a, b) => a + b, 0);
          
          if (totalSubDurationWeight > 0) {
            let allocatedSubDays = 0;
            autoSubSteps.forEach((sub, idx) => {
              const subIndex = updatedItems.findIndex(i => i.id === sub.id);
              if (subIndex === -1) return;
              
              let duration = 0;
              if (idx === autoSubSteps.length - 1) {
                duration = Math.max(1, remainingSubDays - allocatedSubDays);
              } else {
                duration = Math.max(1, Math.round(remainingSubDays * (subStepDurationWeights[idx] / totalSubDurationWeight)));
              }
              allocatedSubDays += duration;
              updatedItems[subIndex].durationManual = duration;
            });
          } else if (autoSubSteps.length > 0) {
            // Fallback se não houver pesos: divide igualmente
            let allocatedSubDays = 0;
            autoSubSteps.forEach((sub, idx) => {
              const subIndex = updatedItems.findIndex(i => i.id === sub.id);
              if (subIndex === -1) return;
              
              let duration = 0;
              if (idx === autoSubSteps.length - 1) {
                duration = Math.max(1, remainingSubDays - allocatedSubDays);
              } else {
                duration = Math.max(1, Math.floor(remainingSubDays / autoSubSteps.length));
              }
              allocatedSubDays += duration;
              updatedItems[subIndex].durationManual = duration;
            });
          }
        }
      });

      // 1. Recalcular durações e propagar datas (5 passagens para garantir propagação)
      // Ordenar projectItems para facilitar a propagação sequencial
      const sortedProjectItems = [...projectItems].sort((a, b) => {
        if (!a.parentStepId && b.parentStepId) return -1;
        if (a.parentStepId && !b.parentStepId) return 1;
        if (a.parentStepId === b.parentStepId) return a.ordem - b.ordem;
        return 0;
      });

      for (let pass = 0; pass < 10; pass++) {
        sortedProjectItems.forEach(item => {
          const itemIndex = updatedItems.findIndex(i => i.id === item.id);
          // Se a data estiver travada manualmente, não recalcular datas para este item
          if (item.dateLockedManual) {
             // Ainda assim, garantir que as datas manuais sejam aplicadas se existirem
             if (item.manualStartDate) updatedItems[itemIndex].startDate = item.manualStartDate;
             if (item.manualEndDate) updatedItems[itemIndex].endDate = item.manualEndDate;
             return;
          }
          
          // Se stageId for fornecido, só recalcular se for a etapa ou subetapa dela
          if (stageId && item.id !== stageId && item.parentStepId !== stageId) return;

          if (itemIndex === -1) return;

          let referenceDate: string | null = null;
          let linkType: 'FS' | 'SS' = updatedItems[itemIndex].linkType || 'FS';
          
          // Verificar atividade liberadora (sistema inteligente)
          const liberatorId = updatedItems[itemIndex].liberatingActivityId;
          if (liberatorId) {
            const liberator = updatedItems.find(i => i.id === liberatorId);
            if (liberator) {
              if (linkType === 'FS' && liberator.endDate) {
                const d = parseDateStr(liberator.endDate);
                if (d) {
                  referenceDate = addDays(d, 1);
                }
              } else if (linkType === 'SS' && liberator.startDate) {
                referenceDate = parseDateStr(liberator.startDate);
              }
            }
          } else {
            // Verificar dependências explícitas
            const deps = updatedItems[itemIndex].dependsOnIds || (updatedItems[itemIndex].dependsOnId ? [updatedItems[itemIndex].dependsOnId] : []);
            if (deps.length > 0) {
              let maxEndDate: string | null = null;
              deps.forEach(depId => {
                const dep = updatedItems.find(i => i.id === depId);
                if (dep && dep.endDate) {
                  const depEnd = parseDateStr(dep.endDate);
                  if (depEnd && (!maxEndDate || compareDates(depEnd, maxEndDate) > 0)) maxEndDate = depEnd;
                }
              });
              if (maxEndDate) {
                referenceDate = addDays(maxEndDate, 1);
              }
            } else if (updatedItems[itemIndex].parentStepId) {
              // Sem dependências e é subetapa -> inicia na data do pai
              const parent = updatedItems.find(i => i.id === updatedItems[itemIndex].parentStepId);
              if (parent && parent.startDate) {
                referenceDate = parseDateStr(parent.startDate);
              } else if (project?.startDate) {
                referenceDate = parseDateStr(project.startDate);
              }
            } else {
              // Sem dependências e é etapa principal -> inicia na data do projeto
              if (project?.startDate) {
                referenceDate = parseDateStr(project.startDate);
              }
            }
          }

          if (updatedItems[itemIndex].manualStartDate) {
            updatedItems[itemIndex].startDate = updatedItems[itemIndex].manualStartDate;
          } else if (referenceDate && !updatedItems[itemIndex].startDateManual) {
            const newStart = referenceDate;
            if (updatedItems[itemIndex].startDate !== newStart) {
              updatedItems[itemIndex].startDate = newStart;
            }
          }

          // Calcular data final baseada na duração (se não for manual)
          if (updatedItems[itemIndex].startDate) {
            if (updatedItems[itemIndex].manualEndDate) {
              updatedItems[itemIndex].endDate = updatedItems[itemIndex].manualEndDate;
            } else if (!updatedItems[itemIndex].endDateManual) {
              const duration = calculateDuration(updatedItems[itemIndex], totalDays);
              const newEnd = addDays(updatedItems[itemIndex].startDate!, duration - 1);
              if (updatedItems[itemIndex].endDate !== newEnd) {
                updatedItems[itemIndex].endDate = newEnd;
              }
            }
          }
        });

        // Atualizar datas, duração e progresso das etapas principais baseadas nas subetapas
        mainSteps.forEach(mainStep => {
          if (mainStep.dateLockedManual) return;
          
          const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id);
          if (subSteps.length > 0) {
            let minStart: string | null = null;
            let maxEnd: string | null = null;
            
            subSteps.forEach(sub => {
              const currentSub = updatedItems.find(i => i.id === sub.id);
              if (currentSub?.startDate) {
                const s = parseDateStr(currentSub.startDate);
                if (s && (!minStart || compareDates(s, minStart) < 0)) minStart = s;
              }
              if (currentSub?.endDate) {
                const e = parseDateStr(currentSub.endDate);
                if (e && (!maxEnd || compareDates(e, maxEnd) > 0)) maxEnd = e;
              }
            });
            
            const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
            if (mainIndex !== -1) {
              const item = updatedItems[mainIndex];
              
              // 1. Atualizar Datas
              if (minStart && !item.startDateManual) item.startDate = minStart;
              if (maxEnd && !item.endDateManual) item.endDate = maxEnd;
              
              // 2. Calcular Duração Real (diferença entre menor data inicial e maior data final)
              if (item.startDate && item.endDate) {
                const duration = getDaysBetween(item.startDate, item.endDate) + 1;
                item.durationManual = duration;
                item.durationManualEnabled = true;
              }

              // 3. Calcular Progresso (Média ponderada)
              const totalWeight = subSteps.reduce((acc, sub) => acc + (sub.realWeight || sub.weight || 1), 0);
              const weightedProgress = subSteps.reduce((acc, sub) => {
                const weight = sub.realWeight || sub.weight || 1;
                const progress = sub.progress || 0;
                return acc + (progress * (weight / (totalWeight || 1)));
              }, 0);
              
              // Regra de bloqueio de 100%: só 100% se todas forem 100%
              const allCompleted = subSteps.every(sub => (sub.progress || 0) === 100);
              let finalProgress = Math.round(weightedProgress);
              if (finalProgress === 100 && !allCompleted) {
                finalProgress = 99;
              }
              
              item.progress = finalProgress;
              item.status = finalProgress === 100 ? 'concluido' : (finalProgress > 0 ? 'em_andamento' : 'pendente');
            }
          }
        });
        }
      });

    return updatedItems;
  };

  // Initial recalculation if needed
  // useEffect(() => {
  //   const recalculated = recalculateSchedule(scheduleItems);
  //   if (JSON.stringify(recalculated) !== JSON.stringify(scheduleItems)) {
  //     setScheduleItems(recalculated);
  //   }
  // }, []);


  // CRUD Implementations
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

  // Helper to remove undefined fields before sending to Firestore
  const cleanData = (data: any) => {
    if (!data || typeof data !== 'object') return data;
    const result: any = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    });
    return result;
  };

  // Recalculate everything: schedule items, project progress, and dashboard
  const recalculateAll = async (projectId?: string, stageId?: string, updatedItem?: ScheduleItem, updatedProject?: Project, forceFullRecalculate?: boolean) => {
    if (!isFirestoreReady) return;

    // Cleanup orphans periodicamente ou em recálculos totais
    if (!projectId || forceFullRecalculate) {
      await cleanupOrphans();
    }

    try {
      console.log(`[RecalculateAll] Iniciando recálculo... Projeto: ${projectId || 'Todos'} ${forceFullRecalculate ? '(FORÇADO)' : ''}`);
      
      // Use current scheduleItems, but include updatedItem if provided
      const currentItems = updatedItem 
        ? scheduleItems.map(item => item.id === updatedItem.id ? updatedItem : item)
        : scheduleItems;

      // 1. Recalcular Cronograma (Datas, Pesos e Progressos das Etapas Pai)
      const updatedSchedule = recalculateSchedule(currentItems, projectId, stageId, updatedProject, forceFullRecalculate);
      
      // 2. Recalcular Progresso das Obras
      const updatedProjects = projects.map(project => {
        const p = (updatedProject && updatedProject.id === project.id) ? updatedProject : project;
        
        // Se não for o projeto alvo do recálculo, retorna o original
        if (projectId && p.id !== projectId) return p;

        const projectItems = updatedSchedule.filter(item => item.projectId === p.id);
        if (projectItems.length === 0) return p;

        // O progresso da obra é a média ponderada das etapas principais (que não têm pai)
        const mainSteps = projectItems.filter(item => !item.parentStepId);
        if (mainSteps.length === 0) return p;

        const totalWeight = mainSteps.reduce((acc, step) => acc + (step.realWeight || step.weight || 0), 0);
        const weightedProgress = mainSteps.reduce((acc, step) => {
          const weight = step.realWeight || step.weight || 0;
          const progress = step.progress || 0;
          return acc + (progress * (weight / (totalWeight || 1)));
        }, 0);

        // Regra de bloqueio de 100%: só 100% se todas as etapas principais forem 100%
        const allCompleted = mainSteps.every(step => (step.progress || 0) === 100);
        let progress = Math.round(weightedProgress);
        if (progress === 100 && !allCompleted) {
          progress = 99; // Força não ser 100% se nem todas estão completas
        }
        
        // Determinar status baseado no progresso
        let status = p.status;
        if (progress === 100) status = 'concluida';
        else if (progress > 0 && status === 'planejamento') status = 'em_execucao';

        // Calcular datas do projeto baseadas no cronograma
        let maxEndDate = p.endDate;
        let minStartDate = p.startDate;
        
        const endDates = projectItems
          .map(i => i.endDate)
          .filter(Boolean) as string[];
        
        if (endDates.length > 0) {
          let maxDateStr = endDates[0];
          for (let i = 1; i < endDates.length; i++) {
            if (compareDates(endDates[i], maxDateStr) > 0) {
              maxDateStr = endDates[i];
            }
          }
          maxEndDate = maxDateStr;
        }

        const startDates = projectItems
          .map(i => i.startDate)
          .filter(Boolean) as string[];
        
        if (startDates.length > 0) {
          let minDateStr = startDates[0];
          for (let i = 1; i < startDates.length; i++) {
            if (compareDates(startDates[i], minDateStr) < 0) {
              minDateStr = startDates[i];
            }
          }
          minStartDate = minDateStr;
        }

        // Se o projeto tem totalDays e startDate, a data final é calculada por eles
        const calculatedEndDate = (p.totalDays && (p.startDate || minStartDate)) 
          ? addDays(p.startDate || minStartDate, p.totalDays - 1) 
          : maxEndDate;

        return { 
          ...p, 
          progress, 
          status,
          startDate: (p.startDate && p.startDate !== '') ? p.startDate : minStartDate,
          endDate: calculatedEndDate,
          updatedAt: new Date().toISOString()
        };
      });

      // 3. Atualizar Firestore em lote (Batch)
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      let hasChanges = false;

      // Atualizar ScheduleItems que mudaram
      updatedSchedule.forEach(item => {
        const original = scheduleItems.find(i => i.id === item.id);
        
        // Se forceFullRecalculate for true, atualizamos todos os itens do projeto alvo
        const isTargetProject = projectId ? item.projectId === projectId : true;
        const shouldUpdate = forceFullRecalculate && isTargetProject;

        if (shouldUpdate || (original && JSON.stringify(original) !== JSON.stringify(item))) {
          const stillExists = scheduleItems.some(i => i.id === item.id) || (updatedItem && updatedItem.id === item.id);
          if (stillExists) {
            hasChanges = true;
            const calculatedFields = {
              progress: item.progress,
              realWeight: item.realWeight,
              status: item.status,
              startDate: item.startDate,
              endDate: item.endDate,
              durationManual: item.durationManual,
              durationManualEnabled: item.durationManualEnabled,
              startDateManual: item.startDateManual,
              endDateManual: item.endDateManual,
              dateLockedManual: item.dateLockedManual,
              manualStartDate: item.manualStartDate,
              manualEndDate: item.manualEndDate,
              manualDays: item.manualDays,
              updatedAt: now
            };
            batch.set(doc(db, 'scheduleItems', item.id), cleanData(calculatedFields), { merge: true });
          }
        }
      });

      // Atualizar Projects que mudaram
      updatedProjects.forEach(project => {
        const original = projects.find(p => p.id === project.id);
        if (original && JSON.stringify(original) !== JSON.stringify(project)) {
          hasChanges = true;
          const calculatedProjectFields = {
            progress: project.progress,
            status: project.status,
            startDate: project.startDate,
            endDate: project.endDate,
            updatedAt: now
          };
          batch.set(doc(db, 'projects', project.id), cleanData(calculatedProjectFields), { merge: true });
        }
      });

      if (hasChanges) {
        await batch.commit();
        
        // Atualização otimista do estado local para evitar flickering
        setScheduleItems(updatedSchedule);
        setProjects(prev => prev.map(p => {
          const updated = updatedProjects.find(up => up.id === p.id);
          return updated || p;
        }));
        
        console.log('[RecalculateAll] Batch commit realizado com sucesso.');
      } else {
        console.log('[RecalculateAll] Nenhuma alteração persistente necessária.');
      }
      
    } catch (error) {
      console.error('[RecalculateAll] Erro fatal:', error);
      throw error;
    }
  };

  const cleanupOrphans = async () => {
    if (!isFirestoreReady) return;
    console.log('[LOG TEMPORÁRIO] Iniciando limpeza de órfãos...');
    
    const batch = writeBatch(db);
    let count = 0;

    // 1. ScheduleItems sem projeto ou com etapa pai inexistente
    const orphanScheduleItems = scheduleItems.filter(item => {
      const hasNoProject = !projects.find(p => p.id === item.projectId);
      const hasInvalidParent = item.parentStepId && !scheduleItems.find(s => s.id === item.parentStepId);
      return hasNoProject || hasInvalidParent;
    });
    orphanScheduleItems.forEach(item => {
      batch.delete(doc(db, 'scheduleItems', item.id));
      count++;
    });

    // 2. Pendencies sem projeto
    const orphanPendencies = pendencies.filter(p => !projects.find(proj => proj.id === p.projectId));
    orphanPendencies.forEach(p => {
      batch.delete(doc(db, 'pendencies', p.id));
      count++;
    });

    // 3. Activities sem projeto
    const orphanActivities = activities.filter(a => !projects.find(p => p.id === a.projectId));
    orphanActivities.forEach(a => {
      batch.delete(doc(db, 'activities', a.id));
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[LOG TEMPORÁRIO] ${count} registros órfãos removidos.`);
    } else {
      console.log('[LOG TEMPORÁRIO] Nenhum registro órfão encontrado.');
    }
  };

  const clearAllData = async () => {
    if (!isFirestoreReady) return;
    try {
      console.log('Iniciando limpeza de todos os dados do sistema...');
      const batch = writeBatch(db);
      
      const collectionsToClear = ['projects', 'pendencies', 'activities', 'scheduleItems', 'transactions'];
      
      for (const col of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, col));
        querySnapshot.forEach(d => {
          batch.delete(d.ref);
        });
      }
      
      await batch.commit();
      console.log('Limpeza de dados concluída com sucesso.');
      
      // Limpar localStorage para evitar que dados antigos voltem
      localStorage.removeItem(STORAGE_KEY);
      
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      throw error;
    }
  };

  const addUser = async (userData: Omit<User, 'id' | 'uid'> & { password?: string }) => {
    let secondaryApp;
    try {
      console.log('Tentando criar/vincular usuário:', userData.email);
      
      // Check if profile already exists in Firestore by email
      const q = query(collection(db, 'users'), where('email', '==', userData.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingProfile = querySnapshot.docs[0].data() as User;
        console.log('Perfil já existe no Firestore:', existingProfile.id);
        throw new Error('Este e-mail já está cadastrado no sistema (Firestore).');
      }

      // Secondary Firebase App to create user without logging out current admin
      const appName = `secondary-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password || 'admin123');
        const newUser = userCredential.user;
        console.log('Usuário criado no Firebase Auth com UID:', newUser.uid);

        const { password, ...profileData } = userData;
        const userProfile: User = {
          ...profileData,
          id: newUser.uid,
          uid: newUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

      await setDoc(doc(db, 'users', newUser.uid), cleanData(userProfile));
      console.log('Perfil salvo no Firestore com UID:', newUser.uid);
      
      return newUser.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        console.warn('E-mail já existe no Auth. Vinculando perfil ao Firestore...');
        
        // Try to sign in to get the existing UID
        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, userData.email, userData.password || 'admin123');
          const existingUser = userCredential.user;
          console.log('Usuário existente vinculado com UID:', existingUser.uid);

          const { password, ...profileData } = userData;
          const userProfile: User = {
            ...profileData,
            id: existingUser.uid,
            uid: existingUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'users', existingUser.uid), cleanData(userProfile));
          console.log('Perfil salvo no Firestore com UID existente:', existingUser.uid);
          
          return existingUser.uid;
        } catch (signInErr) {
          console.error('Erro ao vincular usuário existente:', signInErr);
          throw new Error('Este e-mail já está cadastrado no Firebase Auth, mas não foi possível vincular ao Firestore. Verifique a senha.');
        }
      }
      throw authErr;
    }
  } catch (err: any) {
    console.error('Erro ao adicionar usuário:', err);
    if (err.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    }
    throw err;
  } finally {
      if (secondaryApp) {
        deleteApp(secondaryApp).catch(console.error);
      }
    }
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    try {
      const userRef = doc(db, 'users', id);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      // If password is provided, we'd need to update it in Auth too
      // But updating another user's password from client side is tricky
      const { password, ...firestoreData } = updateData;
      await updateDoc(userRef, cleanData(firestoreData));
      
      // If current user is updating their own profile, update state
      if (currentUser?.id === id) {
        setCurrentUser(prev => prev ? { ...prev, ...firestoreData } : null);
      }
    } catch (err: any) {
      console.error('Erro ao atualizar usuário:', err);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
      }
      throw err;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      // Note: We can't easily delete from Firebase Auth from client side for another user
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
      }
      throw err;
    }
  };

  // Real-time listeners for all collections
  useEffect(() => {
    if (!currentUser) {
      console.log('Aguardando autenticação para iniciar listeners do Firestore...');
      return;
    }

    console.log('Iniciando listeners em tempo real para o usuário:', currentUser.uid);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const firestoreUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as User);
      setUsers(firestoreUsers);
      setIsFirestoreReady(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const firestoreProjects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Project);
      console.log(`[SYNC] Atualizando interface com ${firestoreProjects.length} obras do Firestore.`);
      setProjects(firestoreProjects);
      setIsFirestoreReady(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
    });

    const unsubTemplates = onSnapshot(collection(db, 'projectTemplates'), (snapshot) => {
      const firestoreTemplates = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as ProjectTemplate);
      console.log(`[SYNC] Atualizando interface com ${firestoreTemplates.length} modelos do Firestore.`);
      setProjectTemplates(firestoreTemplates);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projectTemplates');
    });

    const unsubPendencies = onSnapshot(collection(db, 'pendencies'), (snapshot) => {
      const firestorePendencies = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Pendency);
      console.log(`[SYNC] Atualizando interface com ${firestorePendencies.length} pendências do Firestore.`);
      setPendencies(firestorePendencies);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pendencies');
    });

    const unsubActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
      const firestoreActivities = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Activity);
      setActivities(firestoreActivities);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'activities');
    });

    const unsubSchedule = onSnapshot(collection(db, 'scheduleItems'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as ScheduleItem);
      setScheduleItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'scheduleItems');
    });

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const firestoreTransactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Transaction);
      console.log(`[SYNC] Atualizando interface com ${firestoreTransactions.length} transações do Firestore.`);
      setTransactions(firestoreTransactions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as Settings);
        setIsFirestoreReady(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    return () => {
      console.log('Limpando listeners do Firestore...');
      unsubUsers();
      unsubProjects();
      unsubPendencies();
      unsubActivities();
      unsubSchedule();
      unsubTransactions();
      unsubSettings();
    };
  }, [currentUser]);

  // Initialize project templates if they don't exist
  useEffect(() => {
    if (isFirestoreReady && projectTemplates.length === 0 && currentUser?.role === 'administrador') {
      const initTemplates = async () => {
        try {
          console.log('[INIT] Inicializando modelos de cronograma padrão no Firestore...');
          const templates = [
            { id: 'obra_completa', name: 'Obra Completa', type: 'obra_completa', structure: OBRA_COMPLETA_TEMPLATE },
            { id: 'obra_parcial', name: 'Obra Parcial', type: 'obra_parcial', structure: OBRA_PARCIAL_TEMPLATE },
            { id: 'manutencao', name: 'Manutenção', type: 'manutencao', structure: OBRA_MANUTENCAO_TEMPLATE },
            { id: 'em_branco', name: 'Em branco', type: 'em_branco', structure: [] }
          ];

          for (const t of templates) {
            await setDoc(doc(db, 'projectTemplates', t.id), {
              ...t,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('Erro ao inicializar modelos:', err);
        }
      };
      initTemplates();
    }
  }, [isFirestoreReady, projectTemplates.length, currentUser]);

  const addProject = async (project: Omit<Project, 'id'>) => {
    try {
      const id = generateId();
      const newProject = { ...project, id };
      await setDoc(doc(db, 'projects', id), cleanData(newProject));
      
      // Recalcular para inicializar datas do projeto
      await recalculateAll(id, undefined, undefined, newProject as Project, true);
      
      return id;
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'projects');
      }
      throw err;
    }
  };
  const updateProject = async (id: string, data: Partial<Project>) => {
    const oldProject = projects.find(p => p.id === id);
    if (!oldProject) return;
    
    const updatedProject = { ...oldProject, ...data };
    
    // Atualização otimista do estado local
    setProjects(prev => prev.map(p => p.id === id ? updatedProject : p));
    
    try {
      await updateDoc(doc(db, 'projects', id), cleanData(data));
      
      // Se mudar dias totais ou data de início, força recálculo total do cronograma
      // Isso irá resetar as durações manuais para que se ajustem ao novo prazo total
      const forceFullRecalculate = data.totalDays !== undefined || data.startDate !== undefined;
      
      if (forceFullRecalculate) {
        console.log(`[ProjectUpdate] Mudança crítica detectada (totalDays ou startDate). Forçando recálculo total para o projeto ${id}.`);
      }
      
      // Recalcular apenas para esta obra
      await recalculateAll(id, undefined, undefined, updatedProject, forceFullRecalculate);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${id}`);
      }
      throw err;
    }
  };

  const updateProjectTemplate = async (id: string, data: Partial<ProjectTemplate>) => {
    try {
      await setDoc(doc(db, 'projectTemplates', id), {
        ...cleanData(data),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `projectTemplates/${id}`);
      }
      throw err;
    }
  };

  const addProjectTemplate = async (data: Omit<ProjectTemplate, 'id'>) => {
    try {
      const id = generateId();
      const newTemplate = {
        ...cleanData(data),
        id,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'projectTemplates', id), newTemplate);
      return id;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'projectTemplates');
      throw err;
    }
  };

  const deleteProjectTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projectTemplates', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `projectTemplates/${id}`);
      throw err;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      console.log(`[EXCLUSÃO] Iniciando exclusão da obra: ${id}`);
      const batch = writeBatch(db);
      
      // Delete project
      batch.delete(doc(db, 'projects', id));
      
      // Delete related schedule items
      const scheduleQuery = query(collection(db, 'scheduleItems'), where('projectId', '==', id));
      const scheduleDocs = await getDocs(scheduleQuery);
      scheduleDocs.forEach(d => {
        console.log(`[EXCLUSÃO] Removendo item de cronograma vinculado: ${d.id}`);
        batch.delete(d.ref);
      });
      
      // Delete related pendencies
      const pendenciesQuery = query(collection(db, 'pendencies'), where('projectId', '==', id));
      const pendenciesDocs = await getDocs(pendenciesQuery);
      pendenciesDocs.forEach(d => {
        console.log(`[EXCLUSÃO] Removendo pendência vinculada: ${d.id}`);
        batch.delete(d.ref);
      });
      
      // Delete related activities
      const activitiesQuery = query(collection(db, 'activities'), where('projectId', '==', id));
      const activitiesDocs = await getDocs(activitiesQuery);
      activitiesDocs.forEach(d => {
        console.log(`[EXCLUSÃO] Removendo atividade vinculada: ${d.id}`);
        batch.delete(d.ref);
      });
      
      // Delete related transactions
      const transactionsQuery = query(collection(db, 'transactions'), where('projectId', '==', id));
      const transactionsDocs = await getDocs(transactionsQuery);
      transactionsDocs.forEach(d => {
        console.log(`[EXCLUSÃO] Removendo transação vinculada: ${d.id}`);
        batch.delete(d.ref);
      });

      await batch.commit();
      console.log(`[EXCLUSÃO] Obra ${id} e todos os itens vinculados foram excluídos com sucesso do banco de dados.`);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
      }
      throw err;
    }
  };

  const addPendency = async (pendency: Omit<Pendency, 'id'>) => {
    try {
      const id = generateId();
      await setDoc(doc(db, 'pendencies', id), cleanData({ ...pendency, id }));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'pendencies');
      }
      throw err;
    }
  };
  const updatePendency = async (id: string, data: Partial<Pendency>) => {
    try {
      await updateDoc(doc(db, 'pendencies', id), cleanData(data));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `pendencies/${id}`);
      }
      throw err;
    }
  };
  const deletePendency = async (id: string) => {
    try {
      console.log(`[EXCLUSÃO] Excluindo pendência do banco: ${id}`);
      await deleteDoc(doc(db, 'pendencies', id));
      console.log(`[EXCLUSÃO] Pendência ${id} excluída com sucesso.`);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `pendencies/${id}`);
      }
      throw err;
    }
  };

  const addActivity = async (activity: Omit<Activity, 'id'>) => {
    try {
      const id = generateId();
      await setDoc(doc(db, 'activities', id), cleanData({ ...activity, id }));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'activities');
      }
      throw err;
    }
  };
  const updateActivity = async (id: string, data: Partial<Activity>) => {
    try {
      await updateDoc(doc(db, 'activities', id), cleanData(data));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `activities/${id}`);
      }
      throw err;
    }
  };
  const deleteActivity = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'activities', id));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `activities/${id}`);
      }
      throw err;
    }
  };

  const addScheduleItem = async (item: Omit<ScheduleItem, 'id'>) => {
    try {
      const id = generateId();
      
      // Se não tiver ordem, calcular a próxima
      let finalOrdem = item.ordem;
      if (finalOrdem === undefined) {
        const sameLevelItems = scheduleItems.filter(i => 
          i.projectId === item.projectId && 
          i.parentStepId === item.parentStepId
        );
        const maxOrdem = sameLevelItems.reduce((max, i) => Math.max(max, i.ordem || 0), 0);
        finalOrdem = maxOrdem + 1;
      }

      await setDoc(doc(db, 'scheduleItems', id), cleanData({ ...item, id, ordem: finalOrdem }));
      // Após adicionar um item, recalcular apenas para este projeto
      recalculateAll(item.projectId);
      return id;
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'scheduleItems');
      }
      throw err;
    }
  };
  const updateScheduleItem = async (id: string, data: Partial<ScheduleItem>) => {
    const currentItem = scheduleItems.find(i => i.id === id);
    const updatedItem = { 
      ...currentItem, 
      ...data,
      startDateManual: data.startDate !== undefined ? true : currentItem?.startDateManual,
      endDateManual: data.endDate !== undefined ? true : currentItem?.endDateManual
    } as ScheduleItem;
    setScheduleItems(prev => prev.map(item => item.id === id ? updatedItem : item));
    try {
      const docRef = doc(db, 'scheduleItems', id);
      await updateDoc(docRef, cleanData(updatedItem));
      
      // Recálculo controlado: apenas para este projeto
      if (updatedItem.projectId) {
        recalculateAll(updatedItem.projectId, undefined, updatedItem);
      }
    } catch (err: any) {
      // Se o documento não existir, ignoramos silenciosamente pois ele pode ter sido deletado
      // como efeito colateral de outra operação (ex: exclusão de etapa pai)
      if (err.message?.includes('No document to update') || err.code === 'not-found') {
        console.warn(`[Firestore] Tentativa de atualizar item de cronograma inexistente: ${id}. Ignorando.`);
        return;
      }
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `scheduleItems/${id}`);
      }
      throw err;
    }
  };
  const deleteScheduleItem = async (id: string) => {
    const itemToDelete = scheduleItems.find(i => i.id === id);
    const projectId = itemToDelete?.projectId;
    try {
      const batch = writeBatch(db);
      
      // Delete the schedule item
      batch.delete(doc(db, 'scheduleItems', id));
      
      // Delete child schedule items
      const childQuery = query(collection(db, 'scheduleItems'), where('parentStepId', '==', id));
      const childDocs = await getDocs(childQuery);
      childDocs.forEach(d => batch.delete(d.ref));
      
      // Delete related pendencies
      const pendenciesQuery = query(collection(db, 'pendencies'), where('scheduleItemId', '==', id));
      const pendenciesDocs = await getDocs(pendenciesQuery);
      pendenciesDocs.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
      // Após excluir um item, recalcular apenas para este projeto
      if (projectId) recalculateAll(projectId);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `scheduleItems/${id}`);
      }
      throw err;
    }
  };

  const batchUpdateScheduleItems = async (items: { id: string, updates: Partial<ScheduleItem> }[]) => {
    try {
      const batch = writeBatch(db);
      const projectIds = new Set<string>();
      items.forEach(({ id, updates }) => {
        batch.update(doc(db, 'scheduleItems', id), cleanData(updates));
        const item = scheduleItems.find(i => i.id === id);
        if (item?.projectId) projectIds.add(item.projectId);
      });
      await batch.commit();
      // Recalcular apenas para os projetos afetados
      projectIds.forEach(pId => recalculateAll(pId));
    } catch (err: any) {
      console.error('Error batch updating schedule items:', err);
      throw err;
    }
  };

  const generateAutomaticSchedule = async (projectId: string, startDate: string) => {
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      // First, delete all existing schedule items for this project
      const existingItems = scheduleItems.filter(i => i.projectId === projectId);
      existingItems.forEach(item => {
        batch.delete(doc(db, 'scheduleItems', item.id));
      });

      // Also delete related pendencies
      const existingPendencies = pendencies.filter(p => existingItems.some(i => i.id === p.scheduleItemId));
      existingPendencies.forEach(p => {
        batch.delete(doc(db, 'pendencies', p.id));
      });

      const itemsToCreate: ScheduleItem[] = [];

      // Intelligent Sequence Logic for Automatic Schedule
      const stagesToOrder = [
        { id: 'civil', weight: 1, itemCount: 15 },
        { id: 'hidraulica', weight: 1, itemCount: 6 },
        { id: 'exaustao', weight: 1, itemCount: 2 },
        { id: 'incendio', weight: 1, itemCount: 5 },
        { id: 'gesso', weight: 1, itemCount: 4 },
        { id: 'eletrica', weight: 1, itemCount: 24 },
        { id: 'acabamento', weight: 1, itemCount: 10 }
      ];

      const sortedStages = stagesToOrder
        .map(s => ({ ...s, score: getSequenceScore(s.id, s.weight, s.itemCount) }))
        .sort((a, b) => a.score - b.score);

      const dynamicOrders: Record<string, number> = { 'demolicao': 1 };
      sortedStages.forEach((s, index) => {
        dynamicOrders[s.id] = index + 2;
      });
      dynamicOrders['acabamento'] = sortedStages.length + 2;

      // Helper to create an item
      const createItem = (data: Partial<ScheduleItem>) => {
        const id = generateId();
        const item = {
          id,
          projectId,
          progress: 0,
          status: 'pendente' as const,
          createdAt: now,
          updatedAt: now,
          ...data
        } as ScheduleItem;
        itemsToCreate.push(item);
        return id;
      };

      // 1. Demolição (Root)
      const demolicaoId = createItem({
        title: 'Demolição',
        activityType: 'demolicao_simples',
        startDate: startDate,
        complexity: 'media',
        baseDurationDays: BASE_DURATIONS['demolicao_simples'],
        weight: 1,
        ordem: dynamicOrders['demolicao'] || 1
      });
      // Demolições podem ocorrer em paralelo
      createItem({ title: 'Demolição FORRO', parentStepId: demolicaoId, activityType: 'demolicao_forro', complexity: 'media', baseDurationDays: 2, weight: 1, ordem: 1 });
      createItem({ title: 'Demolição PAREDE', parentStepId: demolicaoId, activityType: 'demolicao_parede', complexity: 'media', baseDurationDays: 2, weight: 1, ordem: 2 });

      // 2. Contra piso / Azulejo / Alvenaria
      const civilId = createItem({ title: 'Contra piso / Azulejo / Alvenaria', weight: 1, ordem: dynamicOrders['civil'] || 2 });
      
      // Alvenarias podem ser paralelas após demolição se forem de ambientes diferentes
      const alvenariaId = createItem({
        title: 'Elevação de Alvenaria do Balcão Principal', parentStepId: civilId, activityType: 'elevacao_alvenaria',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: BASE_DURATIONS['elevacao_alvenaria'], weight: 1, ordem: 1,
        workFront: 'Balcão Principal'
      });
      const alvenariaPassapratoId = createItem({
        title: 'Elevação de Alvenaria do Balcão Passaprato', parentStepId: civilId, activityType: 'elevacao_alvenaria',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: BASE_DURATIONS['elevacao_alvenaria'], weight: 1, ordem: 2,
        workFront: 'Balcão Passaprato'
      });

      // Cerâmicas dependem de suas respectivas alvenarias (mesmo ambiente)
      const ceramicaId = createItem({
        title: 'Assentamento de Cerâmica no Balcão Principal', parentStepId: civilId, activityType: 'assentamento_ceramica',
        liberatingActivityId: alvenariaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: BASE_DURATIONS['assentamento_ceramica'], weight: 1, ordem: 3,
        workFront: 'Balcão Principal'
      });
      const ceramicaPassapratoId = createItem({
        title: 'Assentamento de Cerâmica no Balcão Passaprato', parentStepId: civilId, activityType: 'assentamento_ceramica',
        liberatingActivityId: alvenariaPassapratoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: BASE_DURATIONS['assentamento_ceramica'], weight: 1, ordem: 4,
        workFront: 'Balcão Passaprato'
      });

      // Outras atividades civis que podem ser paralelas ou dependem de demolição
      const pastilhasId = createItem({
        title: 'Assentamento de Pastilhas, ATENDIMENTO', parentStepId: civilId, activityType: 'assentamento_pastilhas',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 5,
        workFront: 'Atendimento'
      });
      const preparacaoCozinhaId = createItem({
        title: 'Preparação da parede da COZINHA', parentStepId: civilId, activityType: 'preparacao_parede',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 6,
        workFront: 'Cozinha'
      });

      // Rejuntes dependem das cerâmicas/pastilhas
      const rejunteAtendimentoId = createItem({
        title: 'Rejunte no, ATENDIMENTO', parentStepId: civilId, activityType: 'rejunte',
        liberatingActivityId: ceramicaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 7,
        workFront: 'Balcão Principal'
      });
      const rejuntePastilhasId = createItem({
        title: 'Rejunte nas Pastilhas, ATENDIMENTO', parentStepId: civilId, activityType: 'rejunte',
        liberatingActivityId: pastilhasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 8,
        workFront: 'Atendimento'
      });
      const rejunteCozinhaId = createItem({
        title: 'Rejunte na, COZINHA', parentStepId: civilId, activityType: 'rejunte',
        liberatingActivityId: preparacaoCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 9,
        workFront: 'Cozinha'
      });

      // Granito e Acabamentos finais
      const granitoId = createItem({
        title: 'Instalação de Pedras de Granito', parentStepId: civilId, activityType: 'granito',
        liberatingActivityId: rejunteCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 10
      });
      const cantoneiraId = createItem({
        title: 'Instalação de Cantoneiras na Loja', parentStepId: civilId, activityType: 'cantoneira',
        liberatingActivityId: granitoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 11
      });
      createItem({
        title: 'Limpeza e Organização Final', parentStepId: civilId, activityType: 'outros',
        liberatingActivityId: cantoneiraId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 12
      });

      // 3. Gesso / Parede / Forro
      const gessoId = createItem({ title: 'Gesso / Parede / Forro', weight: 1, ordem: dynamicOrders['gesso'] || 3 });
      
      // Fechamentos de parede podem ser paralelos após demolição
      const fechamentoParedeCozinhaId = createItem({
        title: 'Fechamento da Parede, COZINHA', parentStepId: gessoId, activityType: 'fechamento_parede',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 1,
        workFront: 'Cozinha'
      });
      const fechamentoParedeAtendimentoId = createItem({
        title: 'Fechamento da Parede, ATENDIMENTO', parentStepId: gessoId, activityType: 'fechamento_parede',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 2,
        workFront: 'Atendimento'
      });

      // Fechamentos de forro dependem de infraestruturas (simplificado aqui para depender de demolição + tempo)
      const fechamentoForroCozinhaId = createItem({
        title: 'Fechamento de Forro, COZINHA', parentStepId: gessoId, activityType: 'fechamento_forro',
        liberatingActivityId: fechamentoParedeCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 3,
        workFront: 'Cozinha'
      });
      const fechamentoForroAtendimentoId = createItem({
        title: 'Fechamento de Forro, ATENDIMENTO', parentStepId: gessoId, activityType: 'fechamento_forro',
        liberatingActivityId: fechamentoParedeAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 4,
        workFront: 'Atendimento'
      });

      // 4. Hidráulica
      const hidraulicaId = createItem({ title: 'Hidráulica', weight: 1, ordem: dynamicOrders['hidraulica'] || 4 });
      
      // Revisões podem ser paralelas
      const revisaoTubulacaoEsgotoId = createItem({
        title: 'Revisão Tubulação Esgoto', parentStepId: hidraulicaId, activityType: 'hidraulica_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 1, workFront: 'Área Técnica'
      });
      const impermeabilizacaoRevisaoId = createItem({
        title: 'Impermeabilização/ Revisão no Ralos', parentStepId: hidraulicaId, activityType: 'hidraulica_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 2, workFront: 'Cozinha'
      });
      const revisaoTubulacaoVentilacaoId = createItem({
        title: 'Revisão Tubulação Ventilação / Suspiro', parentStepId: hidraulicaId, activityType: 'hidraulica_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 3, workFront: 'Área Técnica'
      });
      const revisaoTubulacaoDrenoId = createItem({
        title: 'Revisão Tubulação Dreno', parentStepId: hidraulicaId, activityType: 'hidraulica_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 4, workFront: 'Cozinha'
      });
      const revisaoTubulacaoAguaFriaId = createItem({
        title: 'Revisão Tubulação Água Fria', parentStepId: hidraulicaId, activityType: 'hidraulica_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 5, workFront: 'Área Técnica'
      });

      // Instalação final depende das revisões e granito
      createItem({
        title: 'Instalação dos Sifões, Torneiras e Caixas de Gorduras', parentStepId: hidraulicaId, activityType: 'hidraulica_instalacao_final',
        liberatingActivityId: granitoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 6, workFront: 'Cozinha'
      });

      // 5. Exaustão
      const exaustaoId = createItem({ title: 'Exaustão / Ventilação / Ar-condicionado', weight: 1, ordem: dynamicOrders['exaustao'] || 5 });
      const instalacaoCoifaId = createItem({
        title: 'Instalação da Coifa', parentStepId: exaustaoId, activityType: 'coifa',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 1, workFront: 'Cozinha'
      });
      createItem({
        title: 'Instalação de Grelhas', parentStepId: exaustaoId, activityType: 'grelhas',
        liberatingActivityId: fechamentoForroCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 2, workFront: 'Teto'
      });

      // 6. Incêndio
      const incendioId = createItem({ title: 'Sistema de Combate ao Incêndio', weight: 1, ordem: dynamicOrders['incendio'] || 6 });
      const revisaoTubosSPKId = createItem({
        title: 'Revisão Tubos do SPK', parentStepId: incendioId, activityType: 'incendio_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 1, workFront: 'Teto'
      });
      const instalacaoBicosSPKId = createItem({
        title: 'Instalação Bicos do SPK', parentStepId: incendioId, activityType: 'incendio_instalacao',
        liberatingActivityId: fechamentoForroAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 2, workFront: 'Teto'
      });
      const revisaoSistemaGasId = createItem({
        title: 'Revisão do sistema de GAS', parentStepId: incendioId, activityType: 'incendio_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 3, workFront: 'Cozinha'
      });
      const testeEstanqueidadeGasId = createItem({
        title: 'Teste de Estanqueidade de GAS', parentStepId: incendioId, activityType: 'incendio_testes',
        liberatingActivityId: revisaoSistemaGasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 4, workFront: 'Cozinha'
      });
      createItem({
        title: 'Teste de Hidrostático de SPK', parentStepId: incendioId, activityType: 'incendio_testes',
        liberatingActivityId: instalacaoBicosSPKId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 5, workFront: 'Teto'
      });

      // 7. Elétrica
      const eletricaId = createItem({ title: 'Elétrica', weight: 1, ordem: dynamicOrders['eletrica'] || 7 });
      
      // Infras elétricas podem ser todas paralelas após demolição
      const infraSteckFritadeirasId = createItem({
        title: 'Infra Steck Fritadeiras', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 1, workFront: 'Cozinha'
      });
      const infraSteckBanhoMariaId = createItem({
        title: 'Infra Steck Banho Maria', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 2, workFront: 'Cozinha'
      });
      const infraTomadaMicroondasId = createItem({
        title: 'Infra Tomada Microondas / Lidificador', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 3, workFront: 'Cozinha'
      });
      const infraTomadaMaquinaSucoId = createItem({
        title: 'Infra Tomada Maquina de Suco', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 4, workFront: 'Balcão Principal'
      });
      const infraTomadaFreezerId = createItem({
        title: 'Infra Tomada Freezer', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 5, workFront: 'Cozinha'
      });
      const infraDadosImpressoraId = createItem({
        title: 'Infra Dados Impressora, COZINHA', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 6, workFront: 'Cozinha'
      });
      const infraDadosComputadorId = createItem({
        title: 'Infra Dados Computador, ATENDIMENTO', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 7, workFront: 'Atendimento'
      });

      // Cabeamentos dependem de suas respectivas infras
      const cabeamentoSteckFritadeirasId = createItem({
        title: 'Cabeamento Steck Fritadeiras', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraSteckFritadeirasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 8, workFront: 'Cozinha'
      });
      const cabeamentoSteckBanhoMariaId = createItem({
        title: 'Cabeamento Steck Banho Maria', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraSteckBanhoMariaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 9, workFront: 'Cozinha'
      });
      const cabeamentoTomadaMicroondasId = createItem({
        title: 'Cabeamento Tomada Microondas / Lidificador', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraTomadaMicroondasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 10, workFront: 'Cozinha'
      });
      const cabeamentoTomadaMaquinaSucoId = createItem({
        title: 'Cabeamento Tomada Maquina de Suco', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraTomadaMaquinaSucoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 11, workFront: 'Balcão Principal'
      });
      const cabeamentoTomadaFreezerId = createItem({
        title: 'Cabeamento Tomada Freezer', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraTomadaFreezerId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 12, workFront: 'Cozinha'
      });
      const cabeamentoDadosImpressoraId = createItem({
        title: 'Cabeamento Dados Impressora, COZINHA', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraDadosImpressoraId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 13, workFront: 'Cozinha'
      });
      const cabeamentoDadosComputadorId = createItem({
        title: 'Cabeamento Dados Computador, ATENDIMENTO', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraDadosComputadorId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 14, workFront: 'Atendimento'
      });

      // Rabichos dependem de cabeamento
      const colocacaoRabichoMenuId = createItem({
        title: 'Colocação de rabicho (Menuboard, Letreiro, Chama senha)', parentStepId: eletricaId, activityType: 'eletrica_rabicho',
        liberatingActivityId: cabeamentoDadosComputadorId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 15, workFront: 'Atendimento'
      });
      const colocacaoRabichoIlumId = createItem({
        title: 'Colocação de rabicho (Iluminação e Iluminação de emergencia)', parentStepId: eletricaId, activityType: 'eletrica_rabicho',
        liberatingActivityId: cabeamentoDadosComputadorId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 16, workFront: 'Teto'
      });

      // Instalações finais dependem de gesso e pintura (simplificado aqui)
      const acabamentoPontosTomadasId = createItem({
        title: 'Acabamento de pontos de tomadas', parentStepId: eletricaId, activityType: 'eletrica_instalacao',
        liberatingActivityId: colocacaoRabichoMenuId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 17, workFront: 'Paredes'
      });
      const indentificacaoTomadasId = createItem({
        title: 'Indentificação das tomadas/ Quadro', parentStepId: eletricaId, activityType: 'eletrica_instalacao',
        liberatingActivityId: acabamentoPontosTomadasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 18, workFront: 'Área Técnica'
      });
      const instalacaoIlumEmergenciaId = createItem({
        title: 'Instalação Ilum. de Emergência', parentStepId: eletricaId, activityType: 'eletrica_iluminacao',
        liberatingActivityId: fechamentoForroAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 19, workFront: 'Teto'
      });
      const instalacaoIlumCozinhaId = createItem({
        title: 'Instalação Ilum. COZINHA', parentStepId: eletricaId, activityType: 'eletrica_iluminacao',
        liberatingActivityId: fechamentoForroCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 20, workFront: 'Teto'
      });
      const instalacaoIlumAtendimentoId = createItem({
        title: 'Instalação Ilum. ATENDIMENTO', parentStepId: eletricaId, activityType: 'eletrica_iluminacao',
        liberatingActivityId: fechamentoForroAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 21, workFront: 'Teto'
      });
      const instalacaoIlumMezaninoId = createItem({
        title: 'Instalação Ilum. MEZANINO', parentStepId: eletricaId, activityType: 'eletrica_iluminacao',
        liberatingActivityId: fechamentoForroAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 22, workFront: 'Teto'
      });
      const conectirizacaoQuadroId = createItem({
        title: 'Conectirização do quadro', parentStepId: eletricaId, activityType: 'eletrica_quadro',
        liberatingActivityId: indentificacaoTomadasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 23, workFront: 'Área Técnica'
      });
      createItem({
        title: 'Teste de circuitos elétricos', parentStepId: eletricaId, activityType: 'eletrica_testes',
        liberatingActivityId: conectirizacaoQuadroId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 24, workFront: 'Área Técnica'
      });


      // 8. Acabamento
      const acabamentoId = createItem({ title: 'Acabamento', weight: 1, ordem: dynamicOrders['acabamento'] || 8 });
      const preparacaoParedeVermelhaId = createItem({
        title: 'Preparação na Parede Vermelha', parentStepId: acabamentoId, activityType: 'acabamento_preparacao',
        liberatingActivityId: fechamentoForroAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 1, workFront: 'Atendimento'
      });
      const pinturaParedeVermelhaId = createItem({
        title: 'Pintura na Parede Vermelha, ATENDIMENTO', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: preparacaoParedeVermelhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 2, workFront: 'Atendimento'
      });
      const acabamentoTetoCozinhaId = createItem({
        title: 'Acabamento no Teto, COZINHA', parentStepId: acabamentoId, activityType: 'acabamento_final',
        liberatingActivityId: pinturaParedeVermelhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 3, workFront: 'Teto'
      });
      const acabamentoTetoAtendimentoId = createItem({
        title: 'Acabamento no Teto, ATENDIMENTO', parentStepId: acabamentoId, activityType: 'acabamento_final',
        liberatingActivityId: acabamentoTetoCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 4, workFront: 'Teto'
      });
      const acabamentoParedeMezaninoId = createItem({
        title: 'Acabamento Parede, MEZANINO', parentStepId: acabamentoId, activityType: 'acabamento_final',
        liberatingActivityId: acabamentoTetoAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 5, workFront: 'Mezanino'
      });
      const pinturaTetoCozinhaId = createItem({
        title: 'Pitura no teto, COZINHA', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: acabamentoParedeMezaninoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 6, workFront: 'Teto'
      });
      const pinturaTetoAtendimentoId = createItem({
        title: 'Pitura no Teto, ATENDIMENTO', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: pinturaTetoCozinhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 7
      });
      const pinturaParedeMezaninoId = createItem({
        title: 'Pitura no Parede, MEZANINO', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: pinturaTetoAtendimentoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 8
      });
      const pinturaNoTetoMezaninoId = createItem({
        title: 'Pitura no Teto, MEZANINO', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: pinturaParedeMezaninoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 9
      });
      const pinturaCasaMaquinasId = createItem({
        title: 'Pitura na casa de MAQUINAS', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: pinturaNoTetoMezaninoId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 10
      });
      createItem({
        title: 'Pitura tubulação Água Fria', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: pinturaCasaMaquinasId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 1, weight: 1, ordem: 11, workFront: 'Área Técnica'
      });

      // 9. Marcenaria
      const marcenariaId = createItem({ title: 'Marcenaria', weight: 1, ordem: dynamicOrders['marcenaria'] || 9 });
      const montagemBalcaoPrincipalId = createItem({
        title: 'Montagem do Balcão Principal', parentStepId: marcenariaId, activityType: 'marcenaria_montagem',
        liberatingActivityId: pinturaParedeVermelhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 1, workFront: 'Balcão Principal'
      });
      const montagemMoveisCozinhaId = createItem({
        title: 'Montagem de Móveis, COZINHA', parentStepId: marcenariaId, activityType: 'marcenaria_montagem',
        liberatingActivityId: pinturaParedeVermelhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 2, workFront: 'Cozinha'
      });
      const montagemMoveisAtendimentoId = createItem({
        title: 'Montagem de Móveis, ATENDIMENTO', parentStepId: marcenariaId, activityType: 'marcenaria_montagem',
        liberatingActivityId: pinturaParedeVermelhaId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 3, weight: 1, ordem: 3, workFront: 'Atendimento'
      });

      // 10. Vidraçaria
      const vidracariaId = createItem({ title: 'Vidraçaria', weight: 1, ordem: dynamicOrders['vidracaria'] || 10 });
      const instalacaoVidrosId = createItem({
        title: 'Instalação de Vidros e Espelhos', parentStepId: vidracariaId, activityType: 'vidracaria_instalacao',
        liberatingActivityId: montagemBalcaoPrincipalId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 1, workFront: 'Atendimento'
      });

      // 11. Limpeza e Entrega
      const entregaId = createItem({ title: 'Limpeza e Entrega', weight: 1, ordem: dynamicOrders['entrega'] || 11 });
      const limpezaFinaId = createItem({
        title: 'Limpeza Fina', parentStepId: entregaId, activityType: 'limpeza',
        liberatingActivityId: instalacaoVidrosId, linkType: 'FS', complexity: 'media',
        baseDurationDays: 2, weight: 1, ordem: 1
      });
      createItem({
        title: 'Entrega da Obra', parentStepId: entregaId, activityType: 'entrega',
        liberatingActivityId: limpezaFinaId, linkType: 'FS', complexity: 'baixa',
        baseDurationDays: 1, weight: 1, ordem: 2
      });

      // Calculate dates before committing
      const calculatedItems = recalculateSchedule(itemsToCreate);

      // Add all new items to batch
      calculatedItems.forEach(item => {
        batch.set(doc(db, 'scheduleItems', item.id), cleanData(item));
      });

      await batch.commit();
      
      // We don't need to call recalculateAll() here because we already calculated the dates
      // and the onSnapshot listener will update the local state with the fully calculated items.
    } catch (err: any) {
      console.error('Error generating automatic schedule:', err);
      throw err;
    }
  };

  const generateScheduleByDuration = async (
    projectId: string, 
    startDate: string, 
    totalDays: number, 
    complexity: Complexity,
    weights: {
      demolicao: number;
      civil: number;
      eletrica: number;
      hidraulica: number;
      gesso: number;
      exaustao: number;
      incendio: number;
      acabamento: number;
    }
  ) => {
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      // First, delete all existing schedule items for this project
      const existingItems = scheduleItems.filter(i => i.projectId === projectId);
      existingItems.forEach(item => {
        batch.delete(doc(db, 'scheduleItems', item.id));
      });

      // Also delete related pendencies
      const existingPendencies = pendencies.filter(p => existingItems.some(i => i.id === p.scheduleItemId));
      existingPendencies.forEach(p => {
        batch.delete(doc(db, 'pendencies', p.id));
      });

      const itemsToCreate: ScheduleItem[] = [];

      // Helper to create an item
      const createItem = (data: Partial<ScheduleItem>) => {
        const id = generateId();
        const item = {
          id,
          projectId,
          progress: 0,
          status: 'pendente' as const,
          createdAt: now,
          updatedAt: now,
          ...data
        } as ScheduleItem;
        itemsToCreate.push(item);
        return id;
      };

      // Helper to calculate duration based on weight
      const calcDuration = (weightPct: number) => {
        return Math.max(1, Math.round(totalDays * (weightPct / 100)));
      };

      // Helper to distribute duration among substeps
      const distributeDuration = (totalSubDays: number, subSteps: {id: string, base: number}[]) => {
        const totalBase = subSteps.reduce((acc, sub) => acc + sub.base, 0);
        return subSteps.map(sub => ({
          id: sub.id,
          duration: Math.max(1, Math.round(totalSubDays * (sub.base / totalBase)))
        }));
      };

      // Intelligent Sequence Logic
      const stagesToOrder = [
        { id: 'civil', weight: weights.civil, itemCount: 6 },
        { id: 'hidraulica', weight: weights.hidraulica, itemCount: 4 },
        { id: 'exaustao', weight: weights.exaustao, itemCount: 3 },
        { id: 'incendio', weight: weights.incendio, itemCount: 4 },
        { id: 'gesso', weight: weights.gesso, itemCount: 3 },
        { id: 'eletrica', weight: weights.eletrica, itemCount: 5 },
        { id: 'acabamento', weight: weights.acabamento, itemCount: 4 }
      ];

      const sortedStages = stagesToOrder
        .map(s => ({ ...s, score: getSequenceScore(s.id, s.weight) }))
        .sort((a, b) => a.score - b.score);

      const dynamicOrders: Record<string, number> = { 'demolicao': 1 };
      sortedStages.forEach((s, index) => {
        dynamicOrders[s.id] = index + 2;
      });
      dynamicOrders['acabamento'] = sortedStages.length + 2;

      // 1. Demolição (Root)
      const demolicaoDays = calcDuration(weights.demolicao);
      const demolicaoId = createItem({
        title: 'Demolição',
        activityType: 'demolicao_simples',
        startDate: startDate,
        endDate: addDays(startDate, demolicaoDays - 1),
        complexity: complexity,
        baseDurationDays: demolicaoDays,
        dateLockedManual: true,
        startDateManual: true,
        endDateManual: true,
        weight: weights.demolicao,
        ordem: dynamicOrders['demolicao']
      });
      createItem({ title: 'Demolição FORRO', parentStepId: demolicaoId, activityType: 'demolicao_forro', complexity: complexity, baseDurationDays: Math.max(1, Math.round(demolicaoDays/2)), weight: 1, ordem: 1 });
      createItem({ title: 'Demolição PAREDE', parentStepId: demolicaoId, activityType: 'demolicao_parede', complexity: complexity, baseDurationDays: Math.max(1, Math.round(demolicaoDays/2)), weight: 1, ordem: 2 });

      // 2. Contra piso / Azulejo / Alvenaria
      const civilDays = calcDuration(weights.civil);
      const civilId = createItem({ title: 'Contra piso / Azulejo / Alvenaria', weight: weights.civil, ordem: dynamicOrders['civil'] });
      const civilSubSteps = [
        { id: 'alvenaria', base: BASE_DURATIONS['elevacao_alvenaria'] },
        { id: 'ceramica', base: BASE_DURATIONS['assentamento_ceramica'] },
        { id: 'rejunte', base: BASE_DURATIONS['rejunte'] },
        { id: 'granito', base: BASE_DURATIONS['granito'] },
        { id: 'cantoneira', base: BASE_DURATIONS['cantoneira'] }
      ];
      const civilDist = distributeDuration(civilDays, civilSubSteps);
      
      const alvenariaId = createItem({
        title: 'Elevação de Alvenaria', parentStepId: civilId, activityType: 'elevacao_alvenaria',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: civilDist.find(d => d.id === 'alvenaria')?.duration || 1, weight: 2, ordem: 1
      });
      const ceramicaId = createItem({
        title: 'Assentamento de Cerâmica', parentStepId: civilId, activityType: 'assentamento_ceramica',
        liberatingActivityId: alvenariaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: civilDist.find(d => d.id === 'ceramica')?.duration || 1, weight: 3, ordem: 2
      });
      const rejunteId = createItem({
        title: 'Rejunte', parentStepId: civilId, activityType: 'rejunte',
        liberatingActivityId: ceramicaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: civilDist.find(d => d.id === 'rejunte')?.duration || 1, weight: 1, ordem: 3
      });
      const granitoId = createItem({
        title: 'Instalação de Granito', parentStepId: civilId, activityType: 'granito',
        liberatingActivityId: rejunteId, linkType: 'FS', complexity: complexity,
        baseDurationDays: civilDist.find(d => d.id === 'granito')?.duration || 1, weight: 2, ordem: 4
      });
      createItem({
        title: 'Instalação de Cantoneiras', parentStepId: civilId, activityType: 'cantoneira',
        liberatingActivityId: granitoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: civilDist.find(d => d.id === 'cantoneira')?.duration || 1, weight: 1, ordem: 5
      });

      // 3. Gesso / Parede / Forro
      const gessoDays = calcDuration(weights.gesso);
      const gessoId = createItem({ title: 'Gesso / Parede / Forro', weight: weights.gesso, ordem: dynamicOrders['gesso'] });
      const gessoSubSteps = [
        { id: 'parede', base: BASE_DURATIONS['fechamento_parede'] },
        { id: 'forro', base: BASE_DURATIONS['fechamento_forro'] }
      ];
      const gessoDist = distributeDuration(gessoDays, gessoSubSteps);

      const fechamentoParedeId = createItem({
        title: 'Fechamento de Parede', parentStepId: gessoId, activityType: 'fechamento_parede',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: gessoDist.find(d => d.id === 'parede')?.duration || 1, weight: 2, ordem: 1,
        workFront: 'Geral'
      });
      createItem({
        title: 'Fechamento de Forro', parentStepId: gessoId, activityType: 'fechamento_forro',
        liberatingActivityId: fechamentoParedeId, linkType: 'FS', complexity: complexity,
        baseDurationDays: gessoDist.find(d => d.id === 'forro')?.duration || 1, weight: 3, ordem: 2,
        workFront: 'Geral'
      });

      // 4. Hidráulica
      const hidraulicaDays = calcDuration(weights.hidraulica);
      const hidraulicaId = createItem({ title: 'Hidráulica', weight: weights.hidraulica, ordem: dynamicOrders['hidraulica'] });
      const hidraulicaSubSteps = [
        { id: 'revisao', base: BASE_DURATIONS['hidraulica_revisao'] },
        { id: 'tubulacao', base: BASE_DURATIONS['hidraulica_tubulacao'] },
        { id: 'instalacao', base: BASE_DURATIONS['hidraulica_instalacao_final'] }
      ];
      const hidraulicaDist = distributeDuration(hidraulicaDays, hidraulicaSubSteps);

      const revisaoHidraulicaId = createItem({
        title: 'Revisão Hidráulica', parentStepId: hidraulicaId, activityType: 'hidraulica_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: hidraulicaDist.find(d => d.id === 'revisao')?.duration || 1, weight: 1, ordem: 1
      });
      const tubulacaoId = createItem({
        title: 'Tubulação Hidráulica', parentStepId: hidraulicaId, activityType: 'hidraulica_tubulacao',
        liberatingActivityId: revisaoHidraulicaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: hidraulicaDist.find(d => d.id === 'tubulacao')?.duration || 1, weight: 3, ordem: 2
      });
      createItem({
        title: 'Instalação Final Hidráulica', parentStepId: hidraulicaId, activityType: 'hidraulica_instalacao_final',
        liberatingActivityId: tubulacaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: hidraulicaDist.find(d => d.id === 'instalacao')?.duration || 1, weight: 2, ordem: 3
      });

      // 5. Exaustão
      const exaustaoDays = calcDuration(weights.exaustao);
      const exaustaoId = createItem({ title: 'Exaustão / Ventilação / Ar-condicionado', weight: weights.exaustao, ordem: dynamicOrders['exaustao'] });
      const exaustaoSubSteps = [
        { id: 'coifa', base: BASE_DURATIONS['coifa'] },
        { id: 'grelhas', base: BASE_DURATIONS['grelhas'] }
      ];
      const exaustaoDist = distributeDuration(exaustaoDays, exaustaoSubSteps);

      const coifaId = createItem({
        title: 'Instalação de Coifa', parentStepId: exaustaoId, activityType: 'coifa',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: exaustaoDist.find(d => d.id === 'coifa')?.duration || 1, weight: 3, ordem: 1
      });
      createItem({
        title: 'Instalação de Grelhas', parentStepId: exaustaoId, activityType: 'grelhas',
        liberatingActivityId: coifaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: exaustaoDist.find(d => d.id === 'grelhas')?.duration || 1, weight: 1, ordem: 2
      });

      // 6. Incêndio
      const incendioDays = calcDuration(weights.incendio);
      const incendioId = createItem({ title: 'Sistema de Combate ao Incêndio', weight: weights.incendio, ordem: dynamicOrders['incendio'] });
      const incendioSubSteps = [
        { id: 'revisao', base: BASE_DURATIONS['incendio_revisao'] },
        { id: 'instalacao', base: BASE_DURATIONS['incendio_instalacao'] },
        { id: 'testes', base: BASE_DURATIONS['incendio_testes'] }
      ];
      const incendioDist = distributeDuration(incendioDays, incendioSubSteps);

      const revisaoIncendioId = createItem({
        title: 'Revisão Sistema Incêndio', parentStepId: incendioId, activityType: 'incendio_revisao',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: incendioDist.find(d => d.id === 'revisao')?.duration || 1, weight: 1, ordem: 1
      });
      const instalacaoIncendioId = createItem({
        title: 'Instalação Sistema Incêndio', parentStepId: incendioId, activityType: 'incendio_instalacao',
        liberatingActivityId: revisaoIncendioId, linkType: 'FS', complexity: complexity,
        baseDurationDays: incendioDist.find(d => d.id === 'instalacao')?.duration || 1, weight: 3, ordem: 2
      });
      createItem({
        title: 'Testes Sistema Incêndio', parentStepId: incendioId, activityType: 'incendio_testes',
        liberatingActivityId: instalacaoIncendioId, linkType: 'FS', complexity: complexity,
        baseDurationDays: incendioDist.find(d => d.id === 'testes')?.duration || 1, weight: 1, ordem: 3
      });

      // 7. Elétrica
      const eletricaDays = calcDuration(weights.eletrica);
      const eletricaId = createItem({ title: 'Elétrica', weight: weights.eletrica, ordem: dynamicOrders['eletrica'] });
      const eletricaSubSteps = [
        { id: 'infra', base: BASE_DURATIONS['eletrica_infra'] },
        { id: 'cabeamento', base: BASE_DURATIONS['eletrica_cabeamento'] },
        { id: 'instalacao', base: BASE_DURATIONS['eletrica_iluminacao'] },
        { id: 'testes', base: BASE_DURATIONS['eletrica_testes'] }
      ];
      const eletricaDist = distributeDuration(eletricaDays, eletricaSubSteps);

      const infraEletricaId = createItem({
        title: 'Infraestrutura Elétrica', parentStepId: eletricaId, activityType: 'eletrica_infra',
        liberatingActivityId: demolicaoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: eletricaDist.find(d => d.id === 'infra')?.duration || 1, weight: 3, ordem: 1
      });
      const cabeamentoId = createItem({
        title: 'Cabeamento Elétrico', parentStepId: eletricaId, activityType: 'eletrica_cabeamento',
        liberatingActivityId: infraEletricaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: eletricaDist.find(d => d.id === 'cabeamento')?.duration || 1, weight: 2, ordem: 2
      });
      const instalacaoEletricaId = createItem({
        title: 'Instalação Elétrica/Iluminação', parentStepId: eletricaId, activityType: 'eletrica_iluminacao',
        liberatingActivityId: cabeamentoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: eletricaDist.find(d => d.id === 'instalacao')?.duration || 1, weight: 2, ordem: 3
      });
      createItem({
        title: 'Testes Elétricos', parentStepId: eletricaId, activityType: 'eletrica_testes',
        liberatingActivityId: instalacaoEletricaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: eletricaDist.find(d => d.id === 'testes')?.duration || 1, weight: 1, ordem: 4
      });

      // 8. Acabamento
      const acabamentoDays = calcDuration(weights.acabamento);
      const acabamentoId = createItem({ title: 'Acabamento', weight: weights.acabamento, ordem: dynamicOrders['acabamento'] });
      const acabamentoSubSteps = [
        { id: 'preparacao', base: BASE_DURATIONS['acabamento_preparacao'] },
        { id: 'pintura', base: BASE_DURATIONS['acabamento_pintura'] },
        { id: 'final', base: BASE_DURATIONS['acabamento_final'] }
      ];
      const acabamentoDist = distributeDuration(acabamentoDays, acabamentoSubSteps);

      const preparacaoAcabamentoId = createItem({
        title: 'Preparação para Acabamento', parentStepId: acabamentoId, activityType: 'acabamento_preparacao',
        liberatingActivityId: fechamentoParedeId, linkType: 'FS', complexity: complexity,
        baseDurationDays: acabamentoDist.find(d => d.id === 'preparacao')?.duration || 1, weight: 1, ordem: 1
      });
      const pinturaId = createItem({
        title: 'Pintura', parentStepId: acabamentoId, activityType: 'acabamento_pintura',
        liberatingActivityId: preparacaoAcabamentoId, linkType: 'FS', complexity: complexity,
        baseDurationDays: acabamentoDist.find(d => d.id === 'pintura')?.duration || 1, weight: 3, ordem: 2
      });
      createItem({
        title: 'Acabamento Final', parentStepId: acabamentoId, activityType: 'acabamento_final',
        liberatingActivityId: pinturaId, linkType: 'FS', complexity: complexity,
        baseDurationDays: acabamentoDist.find(d => d.id === 'final')?.duration || 1, weight: 2, ordem: 3
      });


      // Calculate dates before committing
      const calculatedItems = recalculateSchedule(itemsToCreate);

      // Add all new items to batch
      calculatedItems.forEach(item => {
        batch.set(doc(db, 'scheduleItems', item.id), cleanData(item));
      });

      await batch.commit();
      
      // Return the calculated items so the caller can check the final duration
      return calculatedItems;
    } catch (err: any) {
      console.error('Error generating schedule by duration:', err);
      throw err;
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      const id = generateId();
      await setDoc(doc(db, 'transactions', id), cleanData({ ...transaction, id }));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'transactions');
      }
      throw err;
    }
  };
  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    try {
      await updateDoc(doc(db, 'transactions', id), cleanData(data));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${id}`);
      }
      throw err;
    }
  };
  const deleteTransaction = async (id: string) => {
    try {
      console.log(`[EXCLUSÃO] Excluindo transação financeira do banco: ${id}`);
      await deleteDoc(doc(db, 'transactions', id));
      console.log(`[EXCLUSÃO] Transação ${id} excluída com sucesso.`);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
      }
      throw err;
    }
  };

  const updateSettings = async (data: Partial<Settings>) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), cleanData({ ...settings, ...data }), { merge: true });
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.WRITE, 'settings/global');
      }
      throw err;
    }
  };

  return (
    <DataContext.Provider value={{ 
      users, projects, projectTemplates, pendencies, activities, scheduleItems, transactions, settings,
      addUser, updateUser, deleteUser,
      addProject, updateProject, deleteProject,
      updateProjectTemplate,
      addProjectTemplate,
      deleteProjectTemplate,
      addPendency, updatePendency, deletePendency,
      addActivity, updateActivity, deleteActivity,
      addScheduleItem, updateScheduleItem, deleteScheduleItem, batchUpdateScheduleItems, generateAutomaticSchedule, generateScheduleByDuration,
      addTransaction, updateTransaction, deleteTransaction,
      updateSettings,
      migrateToFirestore,
      exportBackup,
      exportEmptyTemplate,
      importBackup,
      isMigrated,
      isMigrating,
      isImporting,
      migrationLog,
      dataStatus,
      currentUser, loading, error, login, register, logout,
      recalculateAll,
      clearAllData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
