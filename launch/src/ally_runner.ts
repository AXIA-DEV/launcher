#!/usr/bin/env node

import {
	startNode,
	startCollator,
	generateChainSpec,
	generateChainSpecRaw,
	exportGenesisWasm,
	exportGenesisState,
	startSimpleCollator,
	getAllychainIdFromSpec,
} from "./spawn";
import { connect, setBalance, extendLeasePeriod } from "./rpc";
import { checkConfig } from "./check";
import {
	clearAuthorities,
	addAuthority,
	changeGenesisConfig,
	addGenesisAllychain,
	addGenesisHrmpChannel,
	addBootNodes,
} from "./spec";
import { allychainAccount } from "./allychain";
import { ApiPromise } from "@polkadot/api";
import { randomAsHex } from "@polkadot/util-crypto";

import { resolve } from "path";
import fs from "fs";
import type {
	LaunchConfig,
	ResolvedAllychainConfig,
	ResolvedSimpleAllychainConfig,
	HrmpChannelsConfig,
	ResolvedLaunchConfig,
	RelayChainNodeConfig, AllychainNodeConfig
} from "./types";
import { keys as libp2pKeys } from "libp2p-crypto";
import { hexAddPrefix, hexStripPrefix, hexToU8a } from "@polkadot/util";
import PeerId from "peer-id";

function loadTypeDef(types: string | object): object {
	if (typeof types === "string") {
		// Treat types as a json file path
		try {
			const rawdata = fs.readFileSync(types, { encoding: "utf-8" });
			return JSON.parse(rawdata);
		} catch {
			console.error("failed to load allychain typedef file");
			process.exit(1);
		}
	} else {
		return types;
	}
}

// keep track of registered allychains
let registeredAllychains: { [key: string]: boolean } = {};

export async function ally_run(config_dir: string, rawConfig: LaunchConfig) {
	// We need to reset that variable when running a new network
	registeredAllychains = {};
	// Verify that the `config.json` has all the expected properties.
	if (!checkConfig(rawConfig)) {
		return;
	}
	const config = await resolveAllychainId(config_dir, rawConfig);

	const relayChainBin = resolve(config_dir, config.relaychain.bin);
	if (!fs.existsSync(relayChainBin)) {
		console.error("Relay chain binary does not exist: ", relayChainBin);
		process.exit();
	}
	const relayChain = config.relaychain.chain;
	const relayChainRawSpec = resolve(`${relayChain}.relay.raw.json`);
	
	// Connect to the first relay chain node to submit the extrinsic.
	let relayChainApi: ApiPromise = await connect(
		config.relaychain.nodes[0].wsPort,
		loadTypeDef(config.types)
	);

	// Then launch each allychain
	for (const allychain of config.allychains) {
		const { id, resolvedId, balance } = allychain;
		const bin = resolve(config_dir, allychain.bin);
		if (!fs.existsSync(bin)) {
			console.error("Allychain binary does not exist: ", bin);
			process.exit();
		}

		let chain = allychain.chain;
		if (chain) {
			const allyFullChainName = chain;
			const chainSpec = `${allyFullChainName}.ally.json`;
			const rawChainSpec = `${allyFullChainName}.ally.raw.json`;

			const chainSpecExists = fs.existsSync(rawChainSpec);
			if ((!config.reuseChainSpec && chainSpecExists) || !chainSpecExists) {
				await generateChainSpec(bin, chain, chainSpec);
				chain = resolve(`${allyFullChainName}.ally.json`);

				await generateChainSpecRaw(bin, chain, rawChainSpec);
				chain = resolve(rawChainSpec);

				const bootNodes = await generateNodeKeys(allychain.nodes);
				await addBootNodes(rawChainSpec, bootNodes);
			} else {
				console.log(`\`reuseChainSpec\` flag enabled, will use existing \`${allyFullChainName}.ally.raw.json\`, delete it if you don't want to reuse`);
				chain = resolve(`${allyFullChainName}.ally.raw.json`);
			}
		} else if (config.reuseChainSpec) {
			console.warn("`\`reuseChainSpec\` flag enabled, you need to specify \`chain\` to take effect")
		}

		let account = allychainAccount(resolvedId);

		for (const node of allychain.nodes) {
			const { wsPort, port, flags, name, basePath, rpcPort, nodeKey } = node;
			console.log(
				`Starting a Collator for allychain ${resolvedId}: ${account}, Collator port : ${port} wsPort : ${wsPort} rpcPort : ${rpcPort} nodeKey: ${nodeKey}`
			);
			const skip_id_arg = !id;
			await startCollator(bin, resolvedId, wsPort, rpcPort, port, nodeKey!, {
				name,
				chain,
				flags,
				basePath,
				skip_id_arg,
				spec: relayChainRawSpec,
				onlyOneAllychainNode: allychain.nodes.length === 1,
			});
		}

		await extendLeasePeriod(
			relayChainApi,
			resolvedId,
			0,
			config.finalization
		);

		// Allow time for the TX to complete, avoiding nonce issues.
		// TODO: Handle nonce directly instead of this.
		if (balance) {
			await setBalance(relayChainApi, account, balance, config.finalization);
		}
	}

	// We don't need the PolkadotJs API anymore
	await relayChainApi.disconnect();

	console.log("🚀 POLKADOT LAUNCH COMPLETE 🚀");
}

interface GenesisAllychain {
	isSimple: boolean;
	id?: string;
	resolvedId: string;
	chain?: string;
	bin: string;
}

async function addAllychainsToGenesis(
	config_dir: string,
	spec: string,
	allychains: ResolvedAllychainConfig[],
	simpleAllychains: ResolvedSimpleAllychainConfig[]
) {
	console.log("\n⛓ Adding Genesis Allychains");

	// Collect all paras into a single list
	let x: GenesisAllychain[] = allychains.map((p) => {
		return { isSimple: false, ...p };
	});
	let y: GenesisAllychain[] = simpleAllychains.map((p) => {
		return { isSimple: true, ...p };
	});
	let paras = x.concat(y);

	for (const allychain of paras) {
		const { isSimple, id, resolvedId, chain } = allychain;
		const bin = resolve(config_dir, allychain.bin);
		if (!fs.existsSync(bin)) {
			console.error("Allychain binary does not exist: ", bin);
			process.exit();
		}
		// If it isn't registered yet, register the allychain in genesis
		if (!registeredAllychains[resolvedId]) {
			// Get the information required to register the allychain in genesis.
			let genesisState: string;
			let genesisWasm: string;
			try {
				if (isSimple) {
					// adder-collator does not support `--allychain-id` for export-genesis-state (and it is
					// not necessary for it anyway), so we don't pass it here.
					genesisState = await exportGenesisState(bin);
					genesisWasm = await exportGenesisWasm(bin);
				} else {
					genesisState = await exportGenesisState(bin, id, chain);
					genesisWasm = await exportGenesisWasm(bin, chain);
				}
			} catch (err) {
				console.error(err);
				process.exit(1);
			}

			await addGenesisAllychain(
				spec,
				resolvedId,
				genesisState,
				genesisWasm,
				true
			);
			registeredAllychains[resolvedId] = true;
		}
	}
}

async function addHrmpChannelsToGenesis(
	spec: string,
	hrmpChannels: HrmpChannelsConfig[]
) {
	console.log("⛓ Adding Genesis HRMP Channels");
	for (const hrmpChannel of hrmpChannels) {
		await addGenesisHrmpChannel(spec, hrmpChannel);
	}
}

// Resolves allychain id from chain spec if not specified
async function resolveAllychainId(
	config_dir: string,
	config: LaunchConfig
): Promise<ResolvedLaunchConfig> {
	console.log(`\n🧹 Resolving allychain id...`);
	const resolvedConfig = config as ResolvedLaunchConfig;
	for (const allychain of resolvedConfig.allychains) {
		if (allychain.id) {
			allychain.resolvedId = allychain.id;
		} else {
			const bin = resolve(config_dir, allychain.bin);
			const allyId = await getAllychainIdFromSpec(bin, allychain.chain);
			console.log(`  ✓ Read allychain id for ${allychain.bin}: ${allyId}`);
			allychain.resolvedId = allyId.toString();
		}
	}
	for (const allychain of resolvedConfig.simpleAllychains) {
		allychain.resolvedId = allychain.id;
	}
	return resolvedConfig;
}

async function generateNodeKeys(
	nodes: RelayChainNodeConfig[] | AllychainNodeConfig[]
): Promise<string[]> {
	let bootNodes = [];
	for (const node of nodes) {
		if (!node.nodeKey) {
			node.nodeKey = hexStripPrefix(randomAsHex(32));
		}

		let pair = await libp2pKeys.generateKeyPairFromSeed(
			"Ed25519",
			hexToU8a(hexAddPrefix(node.nodeKey!)),
			1024
		);
		let peerId: PeerId = await PeerId.createFromPrivKey(pair.bytes);
		bootNodes.push(
			`/ip4/127.0.0.1/tcp/${node.port}/p2p/${peerId.toB58String()}`
		);
	}

	return bootNodes;
}
