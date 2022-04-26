// USAGE
// NUM_VALIDATORS=3 NUM_TECH_COMMITTEE=0 ENDOWMENT='' MNEMONIC='xxx' OUT=../../node/res/khala_local_genesis_info.json node gen_khala_genesis.js

require('dotenv').config();

const { Keyring } = require('@polkadot/keyring');
const { cryptoWaitReady, encodeAddress } = require('@polkadot/util-crypto');
const fs = require('fs');

async function main() {
    const file = fs.readFileSync('./rk.json', { encoding: 'utf-8' });
    const operations = JSON.parse(file);
    const {names, keyTypes, mnemonic} = operations;
    await cryptoWaitReady();
    const sr_keyring = new Keyring({ type: 'sr25519', ss58Format: 0 });
    const ed_keyring = new Keyring({ type: 'ed25519', ss58Format: 0 });
    const ec_keyring = new Keyring({ type: 'ecdsa', ss58Format: 0 });
    
    const initialAuthorities = [];
    const allUris = [];
    const allPubKeys = [];
    const endowedAccounts = [];

    const stashKeys = [];

    for (let i=0; i < names.length; i++) {
        const thisAuth = [];
        const thisUri = [];
        const thisPubKeys = [];
        for (let j=0; j < keyTypes.length; j++) {
            if (keyTypes[j].keyType === 'sr25519'){
                let uri = `${mnemonic}//${names[i]}`;
                if (keyTypes[j] && keyTypes[j].name) {
                    uri = `${uri}//${keyTypes[j].name}`;
                }
                thisUri.push(uri);
                const acc = sr_keyring.addFromUri(uri);
                thisAuth.push(acc.address);
                if (keyTypes[j].name === 'stash' || keyTypes[j].name === 'controller') {
                    if (keyTypes[j].name === 'stash') {
                        stashKeys.push(acc.address);
                    }
                    endowedAccounts.push(acc.address);
                }
                thisPubKeys.push(encodeAddress(acc.publicKey));
            }
            if (keyTypes[j].keyType === 'ed25519'){
                const uri = `${mnemonic}//${names[i]}//${keyTypes[j].name}`;
                thisUri.push(uri);
                const acc = ed_keyring.addFromUri(uri);
                thisAuth.push(acc.address);
                thisPubKeys.push(encodeAddress(acc.publicKey));
            }
            if (keyTypes[j].keyType === 'ecdsa'){
                const uri = `${mnemonic}//${names[i]}//${keyTypes[j].name}`;
                thisUri.push(uri);
                const acc = ec_keyring.addFromUri(uri);
                thisAuth.push(encodeAddress(acc.publicKey));
                thisPubKeys.push(encodeAddress(acc.publicKey));
            }
        }
        initialAuthorities.push(thisAuth);
        allUris.push(thisUri);
        allPubKeys.push(thisPubKeys);  
    }
    // console.log(JSON.stringify({rootKey: endowedAccounts[0], endowedAccounts,initialAuthorities }, undefined, 2));
    // console.log(JSON.stringify({rootKey: endowedAccounts[0], endowedAccounts, initialAuthorities: stashKeys}, undefined, 2))
    // console.log(JSON.stringify({allUris}, undefined, 2));
    console.log(JSON.stringify({allPubKeys}, undefined, 2));
}

main().catch(console.error).finally(() => {process.exit()});
