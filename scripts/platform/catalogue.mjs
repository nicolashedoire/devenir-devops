import { catalogue } from './lib.mjs';
try { console.log(JSON.stringify(await catalogue(), null, 2)); }
catch (error) { console.error(`Catalogue indisponible : ${error.message}`); process.exitCode = 1; }
