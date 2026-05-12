import { ScheduleItem, Project } from '../types';
import { addDays, getDaysBetween, compareDates, parseDateStr } from './dateUtils';

export const recalculateScheduleLogic = (
  items: ScheduleItem[],
  obraId: string | undefined,
  stageId: string | undefined,
  updatedProject: Project | undefined,
  forceFullRecalculate: boolean | undefined,
  projects: Project[]
): ScheduleItem[] => {
  const updatedItems = items.map(item => ({ ...item }));
  const obraIds = obraId ? [obraId] : Array.from(new Set(updatedItems.map(i => i.obraId)));

  obraIds.forEach(pId => {
    const project = (updatedProject && updatedProject.id === pId) ? updatedProject : projects.find(p => p.id === pId);
    if (!project) return;
    
    const totalDays = project.totalDays || 0;
    const projectItems = updatedItems.filter(i => i.obraId === pId);
    const mainSteps = projectItems.filter(i => !i.parentStepId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    // 1. Garantir que todas as etapas tenham uma duração base inicial se não houver
    mainSteps.forEach(step => {
      const itemIndex = updatedItems.findIndex(i => i.id === step.id);
      if (itemIndex !== -1 && !updatedItems[itemIndex].durationManual) {
        updatedItems[itemIndex].durationManual = 1;
      }
    });

    // 2. Distribuir dias dentro de cada etapa entre as subtarefas somente se a etapa pai for a base
    mainSteps.forEach(mainStep => {
      const mainStepIndex = updatedItems.findIndex(i => i.id === mainStep.id);
      if (mainStepIndex === -1) return;
      
      updatedItems[mainStepIndex].realWeight = updatedItems[mainStepIndex].weight || 0;

      const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      if (subSteps.length > 0) {
        subSteps.forEach(sub => {
          const subIndex = updatedItems.findIndex(i => i.id === sub.id);
          if (subIndex !== -1 && !updatedItems[subIndex].durationManual) {
            updatedItems[subIndex].durationManual = 1;
          }
        });
      }
    });

    // 3. Calcular datas
    // Agora calculamos as datas das subtarefas e reavaliamos etapas principais com dependências
    // Precisamos de múltiplas passagens para resolver dependências
    for (let pass = 0; pass < 5; pass++) {
      let currentStageStartDate = project.startDate;

      // Reavaliar etapas principais com dependências
      mainSteps.forEach((mainStep, idx) => {
        const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
        if (mainIndex === -1) return;

        const depType = updatedItems[mainIndex].dependencyType || 'bloqueante';
        const deps = updatedItems[mainIndex].dependsOnIds || (updatedItems[mainIndex].dependsOnId ? [updatedItems[mainIndex].dependsOnId] : []);
        
        if (updatedItems[mainIndex].dateLockedManual && updatedItems[mainIndex].manualStartDate) {
          updatedItems[mainIndex].startDate = updatedItems[mainIndex].manualStartDate;
          if (updatedItems[mainIndex].manualEndDate) {
            updatedItems[mainIndex].endDate = updatedItems[mainIndex].manualEndDate;
          } else {
            updatedItems[mainIndex].endDate = addDays(updatedItems[mainIndex].startDate!, (updatedItems[mainIndex].durationManual || 1) - 1);
          }
          currentStageStartDate = addDays(updatedItems[mainIndex].endDate!, 1);
          return;
        }

        if (deps.length > 0) {
          let maxRefDate: string | null = null;
          let isFF = false;
          deps.forEach(depId => {
            const dep = updatedItems.find(i => i.id === depId);
            if (dep) {
              // Blocking dependencies always push. Flexible ones might be more "lax" but in this motor we treat them as pushing too, 
              // unless we define "Flexible" as "not pushing if it creates a gap". 
              // For now, let's follow the user's "bloqueante empurra" vs "paralela no mesmo tempo".
              const linkType = updatedItems[mainIndex].linkType || 'FS';
              if (linkType === 'FS' && dep.endDate) {
                const d = addDays(dep.endDate, 1);
                if (!maxRefDate || compareDates(d, maxRefDate) > 0) maxRefDate = d;
              } else if (linkType === 'SS' && dep.startDate) {
                const d = dep.startDate;
                if (!maxRefDate || compareDates(d, maxRefDate) > 0) maxRefDate = d;
              } else if (linkType === 'FF' && dep.endDate) {
                const d = dep.endDate;
                if (!maxRefDate || compareDates(d, maxRefDate) > 0) maxRefDate = d;
                isFF = true;
              }
            }
          });

          if (maxRefDate) {
            if (isFF) {
              updatedItems[mainIndex].endDate = maxRefDate;
              updatedItems[mainIndex].startDate = addDays(maxRefDate, -(updatedItems[mainIndex].durationManual || 1) + 1);
            } else {
              updatedItems[mainIndex].startDate = maxRefDate;
              updatedItems[mainIndex].endDate = addDays(maxRefDate, (updatedItems[mainIndex].durationManual || 1) - 1);
            }
          }
        } else if (depType === 'paralela' || updatedItems[mainIndex].canExecuteParallel) {
          updatedItems[mainIndex].startDate = project.startDate;
          updatedItems[mainIndex].endDate = addDays(project.startDate!, (updatedItems[mainIndex].durationManual || 1) - 1);
        } else if (depType === 'flexivel') {
          // Flexible might start with project but doesn't block the sequential flow
          updatedItems[mainIndex].startDate = project.startDate;
          updatedItems[mainIndex].endDate = addDays(project.startDate!, (updatedItems[mainIndex].durationManual || 1) - 1);
        } else {
          // Sequencial (Bloqueante por default para o fluxo da lista)
          updatedItems[mainIndex].startDate = currentStageStartDate;
          updatedItems[mainIndex].endDate = addDays(currentStageStartDate!, (updatedItems[mainIndex].durationManual || 1) - 1);
        }

        // Determinar se empurra a próxima etapa no fluxo sequencial
        if (depType === 'bloqueante' && !updatedItems[mainIndex].canExecuteParallel) {
          currentStageStartDate = addDays(updatedItems[mainIndex].endDate!, 1);
        }
      });

      mainSteps.forEach(mainStep => {
        const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
        const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        let previousSubEndDate: string | undefined;

        subSteps.forEach((sub, idx) => {
          const subIndex = updatedItems.findIndex(i => i.id === sub.id);
          if (subIndex === -1) return;

          if (updatedItems[subIndex].dateLockedManual && updatedItems[subIndex].manualStartDate) {
            updatedItems[subIndex].startDate = updatedItems[subIndex].manualStartDate;
            if (updatedItems[subIndex].manualEndDate) {
              updatedItems[subIndex].endDate = updatedItems[subIndex].manualEndDate;
            } else {
              updatedItems[subIndex].endDate = addDays(updatedItems[subIndex].startDate!, (updatedItems[subIndex].durationManual || 1) - 1);
            }
            return;
          }

          let referenceDate = updatedItems[mainIndex].startDate; // Default to stage start
          let isFF = false;

          const depType = updatedItems[subIndex].dependencyType || 'bloqueante';
          const deps = updatedItems[subIndex].dependsOnIds || (updatedItems[subIndex].dependsOnId ? [updatedItems[subIndex].dependsOnId] : []);
          if (deps.length > 0) {
            let maxRefDate: string | null = null;
            deps.forEach(depId => {
              const dep = updatedItems.find(i => i.id === depId);
              if (dep) {
                const linkType = updatedItems[subIndex].linkType || 'FS';
                if (linkType === 'FS' && dep.endDate) {
                  const d = addDays(dep.endDate, 1);
                  if (!maxRefDate || compareDates(d, maxRefDate) > 0) maxRefDate = d;
                } else if (linkType === 'SS' && dep.startDate) {
                  const d = dep.startDate;
                  if (!maxRefDate || compareDates(d, maxRefDate) > 0) maxRefDate = d;
                } else if (linkType === 'FF' && dep.endDate) {
                  const d = dep.endDate;
                  if (!maxRefDate || compareDates(d, maxRefDate) > 0) maxRefDate = d;
                  isFF = true;
                }
              }
            });
            if (maxRefDate) {
              referenceDate = maxRefDate;
            }
          } else {
            // Sem dependências
            if (depType === 'paralela' || depType === 'flexivel' || updatedItems[subIndex].canExecuteParallel) {
              referenceDate = updatedItems[mainIndex].startDate;
            } else {
              // Se não pode executar em paralelo e não tem dependência, segue a ordem da lista (sequencial)
              if (idx > 0 && previousSubEndDate) {
                referenceDate = addDays(previousSubEndDate, 1);
              } else {
                referenceDate = updatedItems[mainIndex].startDate;
              }
            }
          }

          if (isFF && referenceDate) {
            updatedItems[subIndex].endDate = referenceDate;
            updatedItems[subIndex].startDate = addDays(referenceDate, -(updatedItems[subIndex].durationManual || 1) + 1);
          } else if (referenceDate) {
            updatedItems[subIndex].startDate = referenceDate;
            updatedItems[subIndex].endDate = addDays(referenceDate, (updatedItems[subIndex].durationManual || 1) - 1);
          }

          if (depType === 'bloqueante' && !updatedItems[subIndex].canExecuteParallel) {
             previousSubEndDate = updatedItems[subIndex].endDate;
          }
        });

        // Atualizar datas da etapa principal baseada nas subtarefas (se não for travada manualmente)
        if (!updatedItems[mainIndex].dateLockedManual && subSteps.length > 0) {
          let minStart: string | null = null;
          let maxEnd: string | null = null;
          
          subSteps.forEach(sub => {
            const currentSub = updatedItems.find(i => i.id === sub.id);
            if (currentSub?.startDate) {
              if (!minStart || compareDates(currentSub.startDate, minStart) < 0) minStart = currentSub.startDate;
            }
            if (currentSub?.endDate) {
              if (!maxEnd || compareDates(currentSub.endDate, maxEnd) > 0) maxEnd = currentSub.endDate;
            }
          });
          
          if (minStart) updatedItems[mainIndex].startDate = minStart;
          if (maxEnd) updatedItems[mainIndex].endDate = maxEnd;
          
          if (minStart && maxEnd) {
            const calculatedDuration = getDaysBetween(minStart, maxEnd);
            if (!updatedItems[mainIndex].durationManualEnabled || calculatedDuration > (updatedItems[mainIndex].durationManual || 0)) {
              updatedItems[mainIndex].durationManual = calculatedDuration;
            }
          }
        }
      });
    }

    // 4. Calcular Progresso
    mainSteps.forEach(mainStep => {
      const mainIndex = updatedItems.findIndex(i => i.id === mainStep.id);
      const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id);
      
      if (subSteps.length > 0) {
        const totalWeight = subSteps.reduce((acc, sub) => acc + (updatedItems.find(i => i.id === sub.id)?.weight || 1), 0);
        const weightedProgress = subSteps.reduce((acc, sub) => {
          const currentSub = updatedItems.find(i => i.id === sub.id);
          const weight = currentSub?.weight || 1;
          const progress = currentSub?.progress || 0;
          return acc + (progress * (weight / (totalWeight || 1)));
        }, 0);
        
        const allCompleted = subSteps.every(sub => (updatedItems.find(i => i.id === sub.id)?.progress || 0) === 100);
        let finalProgress = Math.round(weightedProgress);
        if (finalProgress === 100 && !allCompleted) {
          finalProgress = 99;
        }
        
        if (mainIndex !== -1) {
          updatedItems[mainIndex].progress = finalProgress;
          updatedItems[mainIndex].status = finalProgress === 100 ? 'concluido' : (finalProgress > 0 ? 'em_andamento' : 'pendente');
        }
      }
    });

  });

  return updatedItems;
};
