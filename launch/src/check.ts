// This function checks that the `config.json` file has all the expected properties.
// It displays a unique error message and returns `false` for any detected issues.
import { LaunchConfig } from "./types";

export function checkConfig(config: LaunchConfig) {
	if (!config) {
		console.error("⚠ Missing config");
		return false;
	}

	if (!config.relaychain) {
		console.error("⚠ Missing `relaychain` object");
		return false;
	}

	if (!config.relaychain.bin) {
		console.error("⚠ Missing `relaychain.bin`");
		return false;
	}

	if (!config.relaychain.chain) {
		console.error("⚠ Missing `relaychain.chain`");
		return false;
	}

	if (config.relaychain.nodes.length == 0) {
		console.error("⚠ No relaychain nodes defined");
		return false;
	}

	for (const node of config.relaychain.nodes) {
		if (node.flags && node.flags.constructor !== Array) {
			console.error("⚠ Relay chain flags should be an array.");
			return false;
		}
	}

	if (!config.allychains) {
		console.error("⚠ Missing `allychains` object");
		return false;
	}

	if (config.allychains.length >= config.relaychain.nodes.length) {
		console.error(
			"⚠ Must have the same or greater number of relaychain nodes than allychains."
		);
		return false;
	}

	for (let allychain of config.allychains) {
		if (!allychain.nodes) {
			console.error("⚠ Missing allychain nodes");
			return false;
		}
	}

	for (let allychain of config.allychains) {
		for (let node of allychain.nodes) {
			if (node.flags && node.flags.constructor !== Array) {
				console.error("⚠ Allychain flags should be an array.");
				return false;
			}
		}
	}

	// Allow the config to not contain `simpleAllychains`
	if (!config.simpleAllychains) {
		config.simpleAllychains = [];
	}

	return true;
}
