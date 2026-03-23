import React, { useState } from 'react';
import Modal from './ui/Modal';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface UpdateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (option: 'A' | 'B' | 'C' | 'D') => void;
}

export default function UpdateTemplateModal({ isOpen, onClose, onApply }: UpdateTemplateModalProps) {
  const [showConfirmD, setShowConfirmD] = useState(false);

  const options = [
    {
      id: 'A',
      title: 'Adicionar apenas itens novos',
      description: 'Mantém o cronograma atual e adiciona somente etapas e subitens que existem no modelo atualizado, mas ainda não existem nesta obra.',
      buttonText: 'Adicionar itens novos',
      isRisky: false,
    },
    {
      id: 'B',
      title: 'Atualizar nomes sem progresso',
      description: 'Atualiza nomes de etapas e subitens apenas dos itens que ainda não possuem progresso, sem alterar o que já está em andamento.',
      buttonText: 'Atualizar nomes',
      isRisky: false,
    },
    {
      id: 'C',
      title: 'Sincronizar com segurança',
      description: 'Adiciona itens novos e atualiza nomes de itens sem progresso, preservando o que já estiver em uso nesta obra.',
      buttonText: 'Sincronizar com segurança',
      isRisky: false,
    },
    {
      id: 'D',
      title: 'Recriar cronograma completo',
      description: 'Apaga o cronograma atual da obra e recria tudo do zero com base no modelo atualizado. ATENÇÃO: Essa opção pode remover a estrutura atual da obra. Usar apenas se eu realmente quiser recomeçar o cronograma desta obra.',
      buttonText: 'Recriar cronograma',
      isRisky: true,
    },
  ];

  if (showConfirmD) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="⚠️ ATENÇÃO: Ação irreversível">
        <div className="space-y-6">
          <div className="p-4 bg-red-950/30 border border-red-500/50 rounded-xl flex gap-4 items-start">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-1" size={32} />
            <p className="text-gray-100 font-medium">
              Tem certeza que deseja apagar o cronograma atual e recriar tudo com base no novo modelo? 
              <span className="block mt-2 font-bold text-red-400">Essa ação NÃO pode ser desfeita e removerá toda a estrutura atual da obra.</span>
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                onApply('D');
                setShowConfirmD(false);
                onClose();
              }}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors"
            >
              Sim, recriar cronograma
            </button>
            <button
              onClick={() => setShowConfirmD(false)}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atualizar obra com novo modelo">
      <div className="space-y-6">
        <p className="text-gray-300">
          O modelo desta obra foi atualizado. Escolha como deseja aplicar as mudanças na obra atual.
        </p>

        <div className="space-y-6">
          {options.map((option) => (
            <div
              key={option.id}
              className={`p-6 rounded-2xl border shadow-md transition-all ${
                option.isRisky
                  ? 'bg-red-950/20 border-red-500/50 hover:border-red-500/70'
                  : 'bg-[#1C2128] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                {option.isRisky && <AlertTriangle className="text-red-500 mt-1" size={20} />}
                <h3 className={`font-bold text-lg ${option.isRisky ? 'text-red-400' : 'text-white'}`}>
                  {option.title}
                </h3>
              </div>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">{option.description}</p>
              <button
                onClick={() => {
                  if (option.isRisky) {
                    setShowConfirmD(true);
                  } else {
                    onApply(option.id as 'A' | 'B' | 'C');
                    onClose();
                  }
                }}
                className={`w-full px-4 py-3 rounded-xl font-semibold transition-all ${
                  option.isRisky
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'
                    : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-lg shadow-[#F97316]/20'
                }`}
              >
                {option.buttonText}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
