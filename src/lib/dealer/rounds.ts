import {
  buildKnowledgeRound,
  type KnowledgeRoundOptions,
} from './knowledgeRounds.ts';
import {buildScenarioRound} from './scenarioRounds.ts';
import type {
  DealerRound,
  DealerRoundKind,
  DealerScenarioArchetype,
} from './types.ts';

export {buildDailyRounds} from './knowledgeRounds.ts';
interface DealerRoundOptions extends Omit<KnowledgeRoundOptions, 'kind'> {
  kind?: DealerRoundKind;
  preferredArchetype?: DealerScenarioArchetype;
  avoidArchetype?: DealerScenarioArchetype;
}

/** 用给定的随机源同步产生指定题型，包括依赖实战推荐器的局面题。 */
export function buildDealerRound(options: DealerRoundOptions): DealerRound {
  if (options.kind === 'scenario') return buildScenarioRound(options);
  return buildKnowledgeRound({...options, kind: options.kind});
}
