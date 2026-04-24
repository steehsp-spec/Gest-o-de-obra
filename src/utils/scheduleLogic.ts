import { ScheduleItem, Project } from '../types';
import { addDays, getDaysBetween, compareDates, parseDateStr } from './dateUtils';

export const recalculateScheduleLogic = (
  items: ScheduleItem[],
  projectId: string | undefined,
  stageId: string | undefined,
  updatedProject: Project | undefined,
  forceFullRecalculate: boolean | undefined,
  projects: Project[]
): ScheduleItem[] => {
  const updatedItems = items.map(item => ({ ...item }));
  const projectIds = projectId ? [projectId] : Array.from(new Set(updatedItems.map(i => i.projectId)));

  projectIds.forEach(pId => {
    const project = (updatedProject && updatedProject.id === pId) ? updatedProject : projects.find(p => p.id === pId);
    if (!project) return;
    
    const totalDays = project.totalDays || 0;
    const projectItems = updatedItems.filter(i => i.projectId === pId);
    const mainSteps = projectItems.filter(i => !i.parentStepId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    // 1. Distribuir dias totais da obra entre as etapas principais
    if (forceFullRecalculate && !stageId && totalDays > 0) {
      const manualMainSteps = mainSteps.filter(s => s.durationManualEnabled && s.durationManual !== undefined);
      
      manualMainSteps.forEach(step => {
        const itemIndex = updatedItems.findIndex(i => i.id === step.id);
        if (itemIndex !== -1) {
          if ((updatedItems[itemIndex].durationManual || 0) > totalDays) {
            updatedItems[itemIndex].durationManual = totalDays;
          }
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
    } else {
      // Ensure all main steps have at least durationManual = 1 if undefined
      mainSteps.forEach(step => {
        const itemIndex = updatedItems.findIndex(i => i.id === step.id);
        if (itemIndex !== -1 && updatedItems[itemIndex].durationManual === undefined) {
          updatedItems[itemIndex].durationManual = 1;
        }
      });
    }

    // 2. Distribuir dias dentro de cada etapa entre as subtarefas
    mainSteps.forEach(mainStep => {
      const mainStepIndex = updatedItems.findIndex(i => i.id === mainStep.id);
      if (mainStepIndex !== -1) {
        updatedItems[mainStepIndex].realWeight = updatedItems[mainStepIndex].weight || 0;
      }

      const subSteps = projectItems.filter(i => i.parentStepId === mainStep.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      if (subSteps.length > 0) {
        // Map complexity to weight
        subSteps.forEach(sub => {
          const subIndex = updatedItems.findIndex(i => i.id === sub.id);
          if (subIndex !== -1) {
            let compWeight = 1;
            if (sub.complexity === 'media') compWeight = 2;
            if (sub.complexity === 'alta') compWeight = 3;
            updatedItems[subIndex].weight = compWeight;
          }
        });

        const totalComplexityWeight = subSteps.reduce((acc, sub) => acc + (updatedItems.find(i => i.id === sub.id)?.weight || 1), 0);
        
        subSteps.forEach(sub => {
          const subIndex = updatedItems.findIndex(i => i.id === sub.id);
          if (subIndex !== -1) {
            const complexityWeight = updatedItems[subIndex].weight || 1;
            const parentWeight = updatedItems[mainStepIndex].weight || 0;
            const realWeight = parentWeight * (complexityWeight / (totalComplexityWeight || 1));
            updatedItems[subIndex].realWeight = Number(realWeight.toFixed(2));
            
            if (updatedItems[subIndex].durationManual === undefined) {
               updatedItems[subIndex].durationManual = 1;
            }
          }
        });

        const stageDuration = updatedItems[mainStepIndex].durationManual || 1;
        const manualSubSteps = subSteps.filter(s => s.durationManualEnabled && s.durationManual !== undefined);
        
        const manualSubDays = manualSubSteps.reduce((acc, s) => acc + (s.durationManual || 0), 0);
        const remainingSubDays = Math.max(0, stageDuration - manualSubDays);
        const autoSubSteps = subSteps.filter(s => !s.durationManualEnabled);
        
        const subStepDurationWeights = autoSubSteps.map(sub => updatedItems.find(i => i.id === sub.id)?.weight || 1);
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
        }
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

        const deps = updatedItems[mainIndex].dependsOnIds || (updatedItems[mainIndex].dependsOnId ? [updatedItems[mainIndex].dependsOnId] : []);
        if (deps.length > 0) {
          let maxRefDate: string | null = null;
          let isFF = false;
          deps.forEach(depId => {
            const dep = updatedItems.find(i => i.id === depId);
            if (dep) {
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
        } else if (updatedItems[mainIndex].canExecuteParallel) {
          updatedItems[mainIndex].startDate = project.startDate;
          updatedItems[mainIndex].endDate = addDays(project.startDate!, (updatedItems[mainIndex].durationManual || 1) - 1);
        } else {
          // Sequencial
          updatedItems[mainIndex].startDate = currentStageStartDate;
          updatedItems[mainIndex].endDate = addDays(currentStageStartDate!, (updatedItems[mainIndex].durationManual || 1) - 1);
        }

        if (!updatedItems[mainIndex].canExecuteParallel && deps.length === 0) {
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
            if (updatedItems[subIndex].canExecuteParallel) {
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

          if (!updatedItems[subIndex].canExecuteParallel) {
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
