import React, { useState } from 'react';
import { Save, Building2, Bell, Shield, Palette, Globe, Database, RefreshCw, Download, Upload, FileJson, AlertCircle, FileCode } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function ConfiguracoesPage() {
  const { settings, updateSettings, migrateToFirestore, currentUser, dataStatus, migrationLog, isMigrating, exportBackup, exportEmptyTemplate, importBackup, isImporting, recalculateAll, clearAllData } = useData();
  const [formData, setFormData] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleClearAllData = async () => {
    setConfirmAction({
      isOpen: true,
      title: 'Limpar TODOS os dados',
      message: 'ATENÇÃO: Esta ação irá apagar TODAS as obras, pendências, atividades, itens de cronograma e transações financeiras do banco de dados. Esta ação NÃO pode ser desfeita. Deseja realmente continuar?',
      onConfirm: async () => {
        try {
          await clearAllData();
          setMessage({ type: 'success', text: 'Todos os dados foram apagados com sucesso!' });
          setTimeout(() => setMessage(null), 5000);
        } catch (error) {
          setMessage({ type: 'error', text: 'Erro ao limpar dados.' });
        }
      }
    });
  };

  const handleMigrate = async () => {
    setConfirmAction({
      isOpen: true,
      title: 'Migrar Dados',
      message: 'Isso irá copiar os dados do seu navegador para o banco de dados online. Deseja continuar?',
      onConfirm: async () => {
        try {
          await migrateToFirestore();
          setMessage({ type: 'success', text: 'Migração concluída com sucesso!' });
          setTimeout(() => setMessage(null), 5000);
        } catch (error) {
          setMessage({ type: 'error', text: 'Erro durante a migração.' });
        }
      }
    });
  };

  const handleExport = async () => {
    try {
      await exportBackup();
      setMessage({ type: 'success', text: 'Backup exportado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao exportar backup.' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    const confirmMsg = importMode === 'replace' 
      ? 'ATENÇÃO: O modo "Substituir tudo" irá apagar os dados atuais e restaurar exatamente o conteúdo do backup. Deseja continuar?'
      : 'Deseja mesclar os dados do backup com os dados atuais?';
      
    setConfirmAction({
      isOpen: true,
      title: 'Importar Backup',
      message: confirmMsg,
      onConfirm: async () => {
        try {
          const result = await importBackup(selectedFile, importMode);
          if (result.success) {
            const { summary } = result;
            setMessage({ 
              type: 'success', 
              text: `Backup importado com sucesso! (${summary.projects} obras, ${summary.scheduleItems} etapas, ${summary.activities} atividades, ${summary.users} usuários)` 
            });
            setSelectedFile(null);
            // Reset file input
            const fileInput = document.getElementById('backup-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            setTimeout(() => setMessage(null), 5000);
          } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao importar backup.' });
          }
        } catch (error) {
          setMessage({ type: 'error', text: 'Erro inesperado ao importar backup.' });
        }
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      updateSettings(formData);
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações do Sistema</h1>
          <p className="text-gray-400 text-sm">Gerencie as preferências da A&R Engenharia</p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded-lg text-sm font-medium animate-fade-in ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados da Empresa */}
        <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-3">
            <Building2 size={20} className="text-[#F97316]" />
            <h3 className="text-lg font-bold text-white">Dados da Empresa</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Nome Fantasia</label>
              <input 
                type="text" 
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">CNPJ</label>
              <input 
                type="text" 
                value={formData.cnpj || ''}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">E-mail de Contato</label>
              <input 
                type="email" 
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Telefone</label>
              <input 
                type="text" 
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>
        </div>

        {/* Preferências do Sistema */}
        <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-3">
            <Palette size={20} className="text-[#F97316]" />
            <h3 className="text-lg font-bold text-white">Preferências e Aparência</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Tema do Sistema</h4>
                <p className="text-sm text-gray-500">Escolha a aparência da interface</p>
              </div>
              <select 
                value={formData.theme || 'dark'}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value as any })}
                className="bg-[#0B0E14] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#F97316]"
              >
                <option value="dark">Escuro (Premium)</option>
                <option value="light">Claro</option>
                <option value="system">Sistema</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Idioma</h4>
                <p className="text-sm text-gray-500">Idioma padrão das labels e relatórios</p>
              </div>
              <select 
                value={formData.language || 'pt-BR'}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="bg-[#0B0E14] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#F97316]"
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">Notificações por E-mail</h4>
                <p className="text-sm text-gray-500">Receber alertas de pendências críticas</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.notificationsEnabled}
                  onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316] peer-checked:after:bg-white"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Backup & Restore Section */}
        <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-3">
            <FileJson size={20} className="text-[#F97316]" />
            <div>
              <h3 className="text-lg font-bold text-white">Backup e Restauração</h3>
              <p className="text-sm text-gray-500 mt-1">Exporte e restaure os dados do sistema com segurança.</p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export */}
              <div className="bg-[#0B0E14] rounded-xl p-5 border border-white/5 space-y-4 flex flex-col justify-center">
                <button 
                  type="button"
                  onClick={handleExport}
                  className="w-full bg-[#F97316] hover:bg-[#F97316]/90 text-white py-3 rounded-lg transition-all font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Exportar Backup
                </button>

                <button 
                  type="button"
                  onClick={exportEmptyTemplate}
                  className="w-full bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-lg border border-white/10 transition-all font-medium text-xs flex items-center justify-center gap-2"
                >
                  <FileCode size={14} />
                  Baixar Modelo
                </button>
              </div>

              {/* Import */}
              <div className="bg-[#0B0E14] rounded-xl p-5 border border-white/5 space-y-4">
                <div className="space-y-4">
                  <input 
                    id="backup-file"
                    type="file" 
                    accept=".json"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10 cursor-pointer"
                  />
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-[#F97316] focus:ring-[#F97316] bg-[#0B0E14] border-white/10"
                      />
                      <span className="text-xs text-gray-300">Mesclar dados</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-[#F97316] focus:ring-[#F97316] bg-[#0B0E14] border-white/10"
                      />
                      <span className="text-xs text-gray-300">Substituir tudo</span>
                    </label>
                  </div>

                  <button 
                    type="button"
                    onClick={handleImport}
                    disabled={!selectedFile || isImporting}
                    className="w-full bg-[#1A1D24] hover:bg-[#2A2D34] text-white py-3 rounded-lg border border-white/10 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        Importar Backup
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {importMode === 'replace' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-400 leading-relaxed">
                  <strong>AVISO:</strong> O modo "Substituir tudo" é destrutivo. Ele irá sobrescrever os registros atuais pelos do backup. Recomendamos exportar um backup do estado atual antes de prosseguir.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Manutenção do Sistema - Apenas para Admin */}
        {currentUser?.email === 'alessandro.aerengenharia2@gmail.com' && (
          <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-3">
              <Database size={20} className="text-[#F97316]" />
              <h3 className="text-lg font-bold text-white">Manutenção e Dados</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">Migração de Dados</h4>
                  <p className="text-sm text-gray-500">Sincronizar dados locais (localStorage) com o Firestore</p>
                </div>
                <button 
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating}
                  className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-white/10 disabled:opacity-50"
                >
                  <RefreshCw size={18} className={isMigrating ? 'animate-spin' : ''} />
                  {isMigrating ? 'Migrando...' : 'Migrar Agora'}
                </button>
              </div>

              {/* Data Audit Summary */}
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-white/5">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resumo da Auditoria de Dados</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(dataStatus.counts).map(([key, count]) => (
                    <div key={key} className="flex flex-col">
                      <span className="text-[10px] text-gray-500 uppercase font-bold">{key}</span>
                      <span className="text-lg font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="mt-8 pt-8 border-t border-red-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-red-500 font-bold mb-1">Zona de Perigo</h4>
                    <p className="text-sm text-gray-500">Ações destrutivas que não podem ser desfeitas.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={handleClearAllData}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-red-500/20 font-semibold"
                  >
                    <AlertCircle size={18} />
                    Limpar Todos os Dados
                  </button>
                </div>
              </div>

              {/* Migration Logs */}
              {migrationLog.length > 0 && (
                <div className="bg-[#0B0E14] rounded-xl p-4 border border-white/5 max-h-40 overflow-y-auto">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Logs de Migração</h4>
                  <ul className="space-y-1">
                    {migrationLog.map((log, i) => (
                      <li key={i} className="text-xs text-emerald-500 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        {log}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recalcular Dados */}
              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Recalcular Dados</h4>
                    <p className="text-sm text-gray-500">Recalcular todos os progressos e pesos do dashboard e cronogramas</p>
                  </div>
                  <button 
                    type="button"
                    onClick={async () => {
                      try {
                        await recalculateAll();
                        setMessage({ type: 'success', text: 'Todos os dados foram recalculados e sincronizados com sucesso!' });
                      } catch (err) {
                        setMessage({ type: 'error', text: 'Erro ao recalcular dados.' });
                      }
                    }}
                    className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-orange-500/20 font-bold text-sm"
                  >
                    <RefreshCw size={18} />
                    Recalcular Agora
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-4">
          <button 
            type="button"
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Descartar Alterações
          </button>
          <button 
            type="submit"
            disabled={isSaving}
            className="bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#F97316]/20"
          >
            <Save size={20} />
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmAction.onConfirm}
        title={confirmAction.title}
        message={confirmAction.message}
      />
    </div>
  );
}
