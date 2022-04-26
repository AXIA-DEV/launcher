export interface CollatorOptions {
	name?: string;
	chain?: string;
	spec?: string;
	flags?: string[];
	basePath?: string;
	skip_id_arg?: boolean;
	onlyOneAllychainNode?: boolean;
}

export interface LaunchConfig {
	relaychain: RelayChainConfig;
	allychains: AllychainConfig[];
	simpleAllychains: SimpleAllychainConfig[];
	hrmpChannels: HrmpChannelsConfig[];
	types: any;
	finalization: boolean;
	reuseChainSpec: boolean;
}
export interface RelayChainNodeConfig {
	name: string;
	basePath?: string;
	wsPort: number;
	rpcPort?: number;
	nodeKey?: string;
	port: number;
	flags?: string[];
}
export interface AllychainNodeConfig {
	rpcPort?: number;
	wsPort: number;
	nodeKey?: string;
	port: number;
	basePath?: string;
	name?: string;
	flags: string[];
}
export interface AllychainConfig {
	bin: string;
	id?: string;
	balance: string;
	chain?: string;
	nodes: AllychainNodeConfig[];
}
export interface SimpleAllychainConfig {
	bin: string;
	id: string;
	port: string;
	balance: string;
}
export interface HrmpChannelsConfig {
	sender: number;
	recipient: number;
	maxCapacity: number;
	maxMessageSize: number;
}
interface ObjectJSON {
	[key: string]: ObjectJSON | number | string;
}
export interface RelayChainConfig {
	bin: string;
	chain: string;
	nodes: RelayChainNodeConfig[];
	genesis?: JSON | ObjectJSON;
}

export interface ChainSpec {
	name: string;
	id: string;
	chainType: string;
	bootNodes: string[];
	telemetryEndpoints: null;
	protocolId: string;
	properties: null;
	forkBlocks: null;
	badBlocks: null;
	consensusEngine: null;
	lightSyncState: null;
	genesis: {
		runtime: any; // this can change depending on the versions
		raw: {
			top: {
				[key: string]: string;
			};
		};
	};
}

export interface ResolvedAllychainConfig extends AllychainConfig {
	resolvedId: string;
}
export interface ResolvedSimpleAllychainConfig extends SimpleAllychainConfig {
	resolvedId: string;
}
export interface ResolvedLaunchConfig extends LaunchConfig {
	allychains: ResolvedAllychainConfig[];
	simpleAllychains: ResolvedSimpleAllychainConfig[];
}
