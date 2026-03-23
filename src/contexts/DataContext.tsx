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
import { User, Project, Pendency, Activity, ScheduleItem, Transaction, Settings, ProjectTemplate } from '../types';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { OBRA_COMPLETA_TEMPLATE, OBRA_PARCIAL_TEMPLATE, OBRA_MANUTENCAO_TEMPLATE } from '../utils/projectTemplates';

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
  
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  migrateToFirestore: () => Promise<void>;
  
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
  logout: () => Promise<void>;
  recalculateAll: () => Promise<void>;
  clearAllData: () => Promise<void>;
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
          role: email === 'alessandro.aerengenharia2@gmail.com' ? 'administrador' : 'encarregado',
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
      } else if (err.code === 'permission-denied') {
        setError('Erro de permissão ao acessar o perfil no banco de dados.');
      } else {
        setError('Erro ao autenticar. Verifique sua conexão e tente novamente.');
      }
      return false;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  // Helper to recalculate weights, progress and dates
  const recalculateSchedule = (items: ScheduleItem[]) => {
    const updatedItems = [...items];
    const projectIds = Array.from(new Set(updatedItems.map(i => i.projectId)));

    projectIds.forEach(projectId => {
      const projectItems = updatedItems.filter(i => i.projectId === projectId);
      const mainSteps = projectItems.filter(i => !i.parentStepId);

      // We need to process items in an order that respects dependencies
      // For simplicity, we'll do multiple passes or a topological sort
      // Let's do a few passes to propagate dates through dependencies
      for (let pass = 0; pass < 3; pass++) {
        mainSteps.forEach(mainStep => {
          const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id);
          
          // Process main step dates first if it has dependencies
          const mainStepDeps = mainStep.dependsOnIds || (mainStep.dependsOnId ? [mainStep.dependsOnId] : []);
          if (mainStepDeps.length > 0) {
            let maxEndDate: Date | null = null;
            mainStepDeps.forEach(depId => {
              const dep = updatedItems.find(i => i.id === depId);
              if (dep && dep.endDate) {
                const depEnd = new Date(dep.endDate);
                if (!maxEndDate || depEnd > maxEndDate) maxEndDate = depEnd;
              }
            });
            if (maxEndDate) {
              const newStart = maxEndDate.toISOString().split('T')[0];
              const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
              if (mainIndex !== -1 && updatedItems[mainIndex].startDate !== newStart) {
                // Update startDate and shift endDate to maintain duration
                const oldStart = updatedItems[mainIndex].startDate ? new Date(updatedItems[mainIndex].startDate!) : null;
                const oldEnd = updatedItems[mainIndex].endDate ? new Date(updatedItems[mainIndex].endDate!) : null;
                updatedItems[mainIndex] = { ...updatedItems[mainIndex], startDate: newStart };
                if (oldStart && oldEnd) {
                  const duration = oldEnd.getTime() - oldStart.getTime();
                  const newEnd = new Date(maxEndDate.getTime() + duration).toISOString().split('T')[0];
                  updatedItems[mainIndex].endDate = newEnd;
                }
              }
            }
          }

          if (subSteps.length > 0) {
            // Soma dos pesos de complexidade (1, 2, 3)
            const totalComplexityWeight = subSteps.reduce((acc, sub) => acc + (sub.weight || 1), 0);
            let weightedProgressSum = 0;
            
            subSteps.forEach(sub => {
              const subIndex = updatedItems.findIndex(i => i.id === sub.id);
              if (subIndex === -1) return;

              // 1. Recalcular Peso Real
              const complexityWeight = sub.weight || 1;
              const realWeight = (mainStep.weight || 0) * (complexityWeight / (totalComplexityWeight || 1));
              updatedItems[subIndex] = { 
                ...updatedItems[subIndex], 
                realWeight: Number(realWeight.toFixed(2))
              };
              
              // 2. Recalcular Datas baseadas em dependências
              const subDeps = sub.dependsOnIds || (sub.dependsOnId ? [sub.dependsOnId] : []);
              if (subDeps.length > 0) {
                let maxEndDate: Date | null = null;
                subDeps.forEach(depId => {
                  const dep = updatedItems.find(i => i.id === depId);
                  if (dep && dep.endDate) {
                    const depEnd = new Date(dep.endDate);
                    if (!maxEndDate || depEnd > maxEndDate) maxEndDate = depEnd;
                  }
                });
                if (maxEndDate) {
                  const newStart = maxEndDate.toISOString().split('T')[0];
                  if (updatedItems[subIndex].startDate !== newStart) {
                    const oldStart = updatedItems[subIndex].startDate ? new Date(updatedItems[subIndex].startDate!) : null;
                    const oldEnd = updatedItems[subIndex].endDate ? new Date(updatedItems[subIndex].endDate!) : null;
                    updatedItems[subIndex].startDate = newStart;
                    if (oldStart && oldEnd) {
                      const duration = oldEnd.getTime() - oldStart.getTime();
                      const newEnd = new Date(maxEndDate.getTime() + duration).toISOString().split('T')[0];
                      updatedItems[subIndex].endDate = newEnd;
                    } else if (mainStep.endDate) {
                      // Se não tinha data, usa a data da etapa como fallback para o fim
                      updatedItems[subIndex].endDate = mainStep.endDate;
                    }
                  }
                }
              } else {
                // Sem dependência: usar data da etapa
                if (mainStep.startDate && updatedItems[subIndex].startDate !== mainStep.startDate) {
                  const oldStart = updatedItems[subIndex].startDate ? new Date(updatedItems[subIndex].startDate!) : null;
                  const oldEnd = updatedItems[subIndex].endDate ? new Date(updatedItems[subIndex].endDate!) : null;
                  updatedItems[subIndex].startDate = mainStep.startDate;
                  if (oldStart && oldEnd) {
                    const duration = oldEnd.getTime() - oldStart.getTime();
                    const newEnd = new Date(new Date(mainStep.startDate).getTime() + duration).toISOString().split('T')[0];
                    updatedItems[subIndex].endDate = newEnd;
                  } else if (mainStep.endDate) {
                    updatedItems[subIndex].endDate = mainStep.endDate;
                  }
                }
              }

              weightedProgressSum += (sub.progress * (complexityWeight / (totalComplexityWeight || 1)));
            });

            const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
            const progress = Math.round(weightedProgressSum);
            if (mainIndex !== -1) {
              updatedItems[mainIndex] = { 
                ...updatedItems[mainIndex], 
                progress,
                realWeight: mainStep.weight || 0,
                status: progress === 100 ? 'concluido' : (progress > 0 ? 'em_andamento' : 'pendente')
              };
            }
          } else {
            // Etapa principal sem subetapas
            const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
            if (mainIndex !== -1) {
              updatedItems[mainIndex] = { 
                ...updatedItems[mainIndex], 
                realWeight: mainStep.weight || 0,
                status: mainStep.progress === 100 ? 'concluido' : (mainStep.progress > 0 ? 'em_andamento' : 'pendente')
              };
            }
          }
        });
      }
    });

    return updatedItems;
  };

  // Initial recalculation if needed
  useEffect(() => {
    const recalculated = recalculateSchedule(scheduleItems);
    if (JSON.stringify(recalculated) !== JSON.stringify(scheduleItems)) {
      setScheduleItems(recalculated);
    }
  }, []);


  // CRUD Implementations
  const generateId = () => Math.random().toString(36).substr(2, 9);

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
  const recalculateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const recalculateAll = async () => {
    if (!isFirestoreReady) return;

    if (recalculateTimeoutRef.current) clearTimeout(recalculateTimeoutRef.current);
    
    recalculateTimeoutRef.current = setTimeout(async () => {
      // Cleanup orphans
      await cleanupOrphans();

      try {
        console.log('Iniciando recálculo total do sistema...');
        
        // 1. Recalcular Cronograma (Pesos e Progressos das Etapas Pai)
        const updatedSchedule = recalculateSchedule(scheduleItems);
        
        // 2. Recalcular Progresso das Obras
        const updatedProjects = projects.map(project => {
          const projectItems = updatedSchedule.filter(item => item.projectId === project.id);
          if (projectItems.length === 0) return project;

          // O progresso da obra é a média ponderada das etapas principais (que não têm pai)
          const mainSteps = projectItems.filter(item => !item.parentStepId);
          if (mainSteps.length === 0) return project;

          const totalWeight = mainSteps.reduce((acc, step) => acc + (step.weight || 0), 0);
          const weightedProgress = mainSteps.reduce((acc, step) => {
            return acc + ((step.progress || 0) * ((step.weight || 0) / (totalWeight || 1)));
          }, 0);

          const progress = Math.round(weightedProgress);
          
          // Determinar status baseado no progresso
          let status = project.status;
          if (progress === 100) status = 'concluido';
          else if (progress > 0 && status === 'planejamento') status = 'em_execucao';

          return { 
            ...project, 
            progress, 
            status,
            updatedAt: new Date().toISOString()
          };
        });

        // 3. Atualizar Firestore em lote (Batch)
        // Usamos setDoc com merge: true em vez de update para evitar erros de "No document to update"
        // caso algum item tenha sido deletado recentemente
        const batch = writeBatch(db);
        
        const now = new Date().toISOString();

        // Atualizar ScheduleItems que mudaram
        updatedSchedule.forEach(item => {
          const original = scheduleItems.find(i => i.id === item.id);
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            // Verificamos se o item ainda existe no estado local para evitar recriar órfãos que acabaram de ser deletados
            const stillExists = scheduleItems.some(i => i.id === item.id);
            if (stillExists) {
              // IMPORTANTE: Só atualizamos os campos calculados para evitar sobrescrever 
              // alterações recentes (como datas) que ainda não foram refletidas no estado local
              const calculatedFields = {
                progress: item.progress,
                realWeight: item.realWeight,
                status: item.status,
                startDate: item.startDate,
                endDate: item.endDate,
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
            // Só atualizamos os campos calculados do projeto
            const calculatedProjectFields = {
              progress: project.progress,
              status: project.status,
              updatedAt: now
            };
            batch.set(doc(db, 'projects', project.id), cleanData(calculatedProjectFields), { merge: true });
          }
        });

        await batch.commit();
        console.log('Recálculo total concluído com sucesso.');
        
        // Os estados locais serão atualizados automaticamente pelos listeners do onSnapshot
      } catch (error) {
        console.error('Erro ao recalcular dados:', error);
      }
    }, 300);
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
        console.warn('E-mail já existe no Auth. Perfil Firestore ausente.');
        return 'auth-exists';
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
      setScheduleItems(recalculateSchedule(items));
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
      await setDoc(doc(db, 'projects', id), cleanData({ ...project, id }));
      return id;
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'projects');
      }
      throw err;
    }
  };
  const updateProject = async (id: string, data: Partial<Project>) => {
    try {
      await updateDoc(doc(db, 'projects', id), cleanData(data));
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
      await setDoc(doc(db, 'scheduleItems', id), cleanData({ ...item, id }));
      // Após adicionar um item, recalcular tudo para garantir consistência
      setTimeout(() => recalculateAll(), 500);
      return id;
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'scheduleItems');
      }
      throw err;
    }
  };
  const updateScheduleItem = async (id: string, data: Partial<ScheduleItem>) => {
    try {
      const docRef = doc(db, 'scheduleItems', id);
      await updateDoc(docRef, cleanData(data));
      // Após atualizar um item, recalcular tudo para garantir consistência
      setTimeout(() => recalculateAll(), 500);
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
      // Após excluir um item, recalcular tudo para garantir consistência
      setTimeout(() => recalculateAll(), 500);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, `scheduleItems/${id}`);
      }
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
      addScheduleItem, updateScheduleItem, deleteScheduleItem,
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
      currentUser, loading, error, login, logout,
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
