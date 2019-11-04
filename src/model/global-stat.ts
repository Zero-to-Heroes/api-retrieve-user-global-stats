import { GlobalStatContext } from './globa-stat-context.type';
import { GlobalStatKey } from './global-stat-key.type';

export class GlobalStat {
	id: number;
	statKey: GlobalStatKey;
	value: number;
	// More or less an equivalent of the gameMode + gamrFormat + scenario ID
	statContext: GlobalStatContext;
}
