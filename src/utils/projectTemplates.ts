import { TemplateStep } from '../types';

export const OBRA_COMPLETA_TEMPLATE: TemplateStep[] = [
  {
    id: 'demolicao',
    title: 'Demolição',
    weight: 5,
    selected: true,
    ordem: 1,
    subSteps: [
      { id: 'demolicao_forro', title: 'Demolição de forro', ordem: 1 },
      { id: 'demolicao_paredes', title: 'Demolição de paredes', ordem: 2 },
      { id: 'remocao_revestimentos', title: 'Remoção de revestimentos', ordem: 3 },
      { id: 'retirada_esquadrias', title: 'Retirada de esquadrias', ordem: 4 },
      { id: 'limpeza_area', title: 'Limpeza da área', ordem: 5 }
    ],
    selectedSubSteps: { 'demolicao_forro': true, 'demolicao_paredes': true, 'remocao_revestimentos': true, 'retirada_esquadrias': true, 'limpeza_area': true },
    subStepComplexities: { 'demolicao_forro': 'media', 'demolicao_paredes': 'alta', 'remocao_revestimentos': 'media', 'retirada_esquadrias': 'baixa', 'limpeza_area': 'baixa' }
  },
  {
    id: 'alvenaria_drywall',
    title: 'Alvenaria / Drywall',
    weight: 10,
    selected: true,
    ordem: 2,
    subSteps: [
      { id: 'marcacao', title: 'Marcação', ordem: 1 },
      { id: 'elevacao_paredes', title: 'Elevação de paredes', ordem: 2 },
      { id: 'fechamento_forro', title: 'Fechamento de forro', ordem: 3 },
      { id: 'tratamento_juntas', title: 'Tratamento de juntas', ordem: 4 }
    ],
    selectedSubSteps: { 'marcacao': true, 'elevacao_paredes': true, 'fechamento_forro': true, 'tratamento_juntas': true },
    subStepComplexities: { 'marcacao': 'baixa', 'elevacao_paredes': 'alta', 'fechamento_forro': 'media', 'tratamento_juntas': 'media' }
  },
  {
    id: 'hidraulica',
    title: 'Hidráulica',
    weight: 10,
    selected: true,
    ordem: 3,
    subSteps: [
      { id: 'tubulacao_agua', title: 'Tubulação de água', ordem: 1 },
      { id: 'tubulacao_esgoto', title: 'Tubulação de esgoto', ordem: 2 },
      { id: 'pontos_hidraulicos', title: 'Pontos hidráulicos', ordem: 3 },
      { id: 'instalacao_loucas', title: 'Instalação de louças', ordem: 4 },
      { id: 'testes_hidraulicos', title: 'Testes hidráulicos', ordem: 5 }
    ],
    selectedSubSteps: { 'tubulacao_agua': true, 'tubulacao_esgoto': true, 'pontos_hidraulicos': true, 'instalacao_loucas': true, 'testes_hidraulicos': true },
    subStepComplexities: { 'tubulacao_agua': 'alta', 'tubulacao_esgoto': 'alta', 'pontos_hidraulicos': 'media', 'instalacao_loucas': 'media', 'testes_hidraulicos': 'baixa' }
  },
  {
    id: 'eletrica',
    title: 'Elétrica',
    weight: 15,
    selected: true,
    ordem: 4,
    subSteps: [
      { id: 'passagem_eletroduto', title: 'Passagem de eletroduto', ordem: 1 },
      { id: 'instalacao_caixas', title: 'Instalação de caixas', ordem: 2 },
      { id: 'passagem_fiacao', title: 'Passagem de fiação', ordem: 3 },
      { id: 'instalacao_tomadas', title: 'Instalação de tomadas', ordem: 4 },
      { id: 'instalacao_iluminacao', title: 'Instalação de iluminação', ordem: 5 },
      { id: 'testes_finais', title: 'Testes finais', ordem: 6 }
    ],
    selectedSubSteps: { 'passagem_eletroduto': true, 'instalacao_caixas': true, 'passagem_fiacao': true, 'instalacao_tomadas': true, 'instalacao_iluminacao': true, 'testes_finais': true },
    subStepComplexities: { 'passagem_eletroduto': 'alta', 'instalacao_caixas': 'media', 'passagem_fiacao': 'alta', 'instalacao_tomadas': 'baixa', 'instalacao_iluminacao': 'media', 'testes_finais': 'baixa' }
  },
  {
    id: 'revestimentos',
    title: 'Revestimentos',
    weight: 20,
    selected: true,
    ordem: 5,
    subSteps: [
      { id: 'regularizacao_base', title: 'Regularização de base', ordem: 1 },
      { id: 'impermeabilizacao', title: 'Impermeabilização', ordem: 2 },
      { id: 'assentamento_piso', title: 'Assentamento de piso', ordem: 3 },
      { id: 'assentamento_azulejo', title: 'Assentamento de azulejo', ordem: 4 },
      { id: 'rejuntamento', title: 'Rejuntamento', ordem: 5 }
    ],
    selectedSubSteps: { 'regularizacao_base': true, 'impermeabilizacao': true, 'assentamento_piso': true, 'assentamento_azulejo': true, 'rejuntamento': true },
    subStepComplexities: { 'regularizacao_base': 'media', 'impermeabilizacao': 'alta', 'assentamento_piso': 'alta', 'assentamento_azulejo': 'alta', 'rejuntamento': 'baixa' }
  },
  {
    id: 'pintura',
    title: 'Pintura',
    weight: 10,
    selected: true,
    ordem: 6,
    subSteps: [
      { id: 'preparacao_superficie', title: 'Preparação de superfície', ordem: 1 },
      { id: 'aplicacao_massa', title: 'Aplicação de massa', ordem: 2 },
      { id: 'lixamento', title: 'Lixamento', ordem: 3 },
      { id: 'pintura_tetos', title: 'Pintura de tetos', ordem: 4 },
      { id: 'pintura_paredes', title: 'Pintura de paredes', ordem: 5 }
    ],
    selectedSubSteps: { 'preparacao_superficie': true, 'aplicacao_massa': true, 'lixamento': true, 'pintura_tetos': true, 'pintura_paredes': true },
    subStepComplexities: { 'preparacao_superficie': 'media', 'aplicacao_massa': 'media', 'lixamento': 'baixa', 'pintura_tetos': 'media', 'pintura_paredes': 'media' }
  },
  {
    id: 'gesso',
    title: 'Gesso',
    weight: 5,
    selected: true,
    ordem: 7,
    subSteps: [
      { id: 'estruturacao', title: 'Estruturação', ordem: 1 },
      { id: 'plaqueamento', title: 'Plaqueamento', ordem: 2 },
      { id: 'acabamento', title: 'Acabamento', ordem: 3 }
    ],
    selectedSubSteps: { 'estruturacao': true, 'plaqueamento': true, 'acabamento': true },
    subStepComplexities: { 'estruturacao': 'media', 'plaqueamento': 'media', 'acabamento': 'baixa' }
  },
  {
    id: 'forro',
    title: 'Forro',
    weight: 5,
    selected: true,
    ordem: 8,
    subSteps: [
      { id: 'estruturacao_forro', title: 'Estruturação', ordem: 1 },
      { id: 'instalacao_placas', title: 'Instalação de placas', ordem: 2 },
      { id: 'acabamento_forro', title: 'Acabamento', ordem: 3 }
    ],
    selectedSubSteps: { 'estruturacao_forro': true, 'instalacao_placas': true, 'acabamento_forro': true },
    subStepComplexities: { 'estruturacao_forro': 'media', 'instalacao_placas': 'media', 'acabamento_forro': 'baixa' }
  },
  {
    id: 'marcenaria',
    title: 'Marcenaria',
    weight: 10,
    selected: true,
    ordem: 9,
    subSteps: [
      { id: 'medicao', title: 'Medição', ordem: 1 },
      { id: 'fabricacao', title: 'Fabricação', ordem: 2 },
      { id: 'montagem', title: 'Montagem', ordem: 3 },
      { id: 'ajustes_finais', title: 'Ajustes finais', ordem: 4 }
    ],
    selectedSubSteps: { 'medicao': true, 'fabricacao': true, 'montagem': true, 'ajustes_finais': true },
    subStepComplexities: { 'medicao': 'baixa', 'fabricacao': 'alta', 'montagem': 'alta', 'ajustes_finais': 'media' }
  },
  {
    id: 'limpeza_final',
    title: 'Limpeza final',
    weight: 5,
    selected: true,
    ordem: 10,
    subSteps: [
      { id: 'remocao_entulho_grossa', title: 'Remoção de entulho grossa', ordem: 1 },
      { id: 'limpeza_fina', title: 'Limpeza fina', ordem: 2 },
      { id: 'limpeza_vidros', title: 'Limpeza de vidros', ordem: 3 },
      { id: 'limpeza_pisos', title: 'Limpeza de pisos', ordem: 4 }
    ],
    selectedSubSteps: { 'remocao_entulho_grossa': true, 'limpeza_fina': true, 'limpeza_vidros': true, 'limpeza_pisos': true },
    subStepComplexities: { 'remocao_entulho_grossa': 'baixa', 'limpeza_fina': 'media', 'limpeza_vidros': 'baixa', 'limpeza_pisos': 'baixa' }
  },
  {
    id: 'entrega',
    title: 'Entrega',
    weight: 5,
    selected: true,
    ordem: 11,
    subSteps: [
      { id: 'vistoria_final', title: 'Vistoria final', ordem: 1 },
      { id: 'correcao_pendencias', title: 'Correção de pendências', ordem: 2 },
      { id: 'entrega_chaves', title: 'Entrega das chaves', ordem: 3 }
    ],
    selectedSubSteps: { 'vistoria_final': true, 'correcao_pendencias': true, 'entrega_chaves': true },
    subStepComplexities: { 'vistoria_final': 'media', 'correcao_pendencias': 'media', 'entrega_chaves': 'baixa' }
  }
];

export const OBRA_PARCIAL_TEMPLATE: TemplateStep[] = [
  {
    id: 'demolicao',
    title: 'Demolição',
    weight: 10,
    selected: true,
    ordem: 1,
    subSteps: [
      { id: 'demolicao_leve', title: 'Demolição leve', ordem: 1 },
      { id: 'remocao_entulho', title: 'Remoção de entulho', ordem: 2 }
    ],
    selectedSubSteps: { 'demolicao_leve': true, 'remocao_entulho': true },
    subStepComplexities: { 'demolicao_leve': 'media', 'remocao_entulho': 'baixa' }
  },
  {
    id: 'reparos',
    title: 'Reparos',
    weight: 20,
    selected: true,
    ordem: 2,
    subSteps: [
      { id: 'reparos_alvenaria', title: 'Reparos em alvenaria', ordem: 1 },
      { id: 'reparos_forro', title: 'Reparos em forro', ordem: 2 }
    ],
    selectedSubSteps: { 'reparos_alvenaria': true, 'reparos_forro': true },
    subStepComplexities: { 'reparos_alvenaria': 'media', 'reparos_forro': 'media' }
  },
  {
    id: 'hidraulica',
    title: 'Hidráulica',
    weight: 15,
    selected: true,
    ordem: 3,
    subSteps: [
      { id: 'manutencao_pontos', title: 'Manutenção de pontos', ordem: 1 },
      { id: 'troca_loucas', title: 'Troca de louças', ordem: 2 }
    ],
    selectedSubSteps: { 'manutencao_pontos': true, 'troca_loucas': true },
    subStepComplexities: { 'manutencao_pontos': 'alta', 'troca_loucas': 'media' }
  },
  {
    id: 'eletrica',
    title: 'Elétrica',
    weight: 15,
    selected: true,
    ordem: 4,
    subSteps: [
      { id: 'revisao_quadros', title: 'Revisão de quadros', ordem: 1 },
      { id: 'troca_tomadas', title: 'Troca de tomadas', ordem: 2 },
      { id: 'troca_iluminacao', title: 'Troca de iluminação', ordem: 3 }
    ],
    selectedSubSteps: { 'revisao_quadros': true, 'troca_tomadas': true, 'troca_iluminacao': true },
    subStepComplexities: { 'revisao_quadros': 'alta', 'troca_tomadas': 'baixa', 'troca_iluminacao': 'media' }
  },
  {
    id: 'revestimentos',
    title: 'Revestimentos',
    weight: 20,
    selected: true,
    ordem: 5,
    subSteps: [
      { id: 'troca_piso_parcial', title: 'Troca de piso parcial', ordem: 1 },
      { id: 'reparo_azulejos', title: 'Reparo de azulejos', ordem: 2 }
    ],
    selectedSubSteps: { 'troca_piso_parcial': true, 'reparo_azulejos': true },
    subStepComplexities: { 'troca_piso_parcial': 'alta', 'reparo_azulejos': 'media' }
  },
  {
    id: 'pintura',
    title: 'Pintura',
    weight: 15,
    selected: true,
    ordem: 6,
    subSteps: [
      { id: 'retoques', title: 'Retoques', ordem: 1 },
      { id: 'pintura_geral', title: 'Pintura geral', ordem: 2 }
    ],
    selectedSubSteps: { 'retoques': true, 'pintura_geral': true },
    subStepComplexities: { 'retoques': 'baixa', 'pintura_geral': 'media' }
  },
  {
    id: 'limpeza_final',
    title: 'Limpeza final',
    weight: 5,
    selected: true,
    ordem: 7,
    subSteps: [
      { id: 'limpeza_geral', title: 'Limpeza geral', ordem: 1 }
    ],
    selectedSubSteps: { 'limpeza_geral': true },
    subStepComplexities: { 'limpeza_geral': 'baixa' }
  }
];

export const OBRA_MANUTENCAO_TEMPLATE: TemplateStep[] = [
  {
    id: 'inspecao',
    title: 'Inspeção',
    weight: 20,
    selected: true,
    ordem: 1,
    subSteps: [
      { id: 'inspecao_geral', title: 'Inspeção geral', ordem: 1 },
      { id: 'identificacao_problemas', title: 'Identificação de problemas', ordem: 2 }
    ],
    selectedSubSteps: { 'inspecao_geral': true, 'identificacao_problemas': true },
    subStepComplexities: { 'inspecao_geral': 'media', 'identificacao_problemas': 'alta' }
  },
  {
    id: 'reparos',
    title: 'Reparos',
    weight: 60,
    selected: true,
    ordem: 2,
    subSteps: [
      { id: 'reparos_pontuais', title: 'Reparos pontuais', ordem: 1 },
      { id: 'substituicao_pecas', title: 'Substituição de peças', ordem: 2 }
    ],
    selectedSubSteps: { 'reparos_pontuais': true, 'substituicao_pecas': true },
    subStepComplexities: { 'reparos_pontuais': 'media', 'substituicao_pecas': 'media' }
  },
  {
    id: 'testes',
    title: 'Testes',
    weight: 20,
    selected: true,
    ordem: 3,
    subSteps: [
      { id: 'testes_funcionamento', title: 'Testes de funcionamento', ordem: 1 }
    ],
    selectedSubSteps: { 'testes_funcionamento': true },
    subStepComplexities: { 'testes_funcionamento': 'baixa' }
  }
];
