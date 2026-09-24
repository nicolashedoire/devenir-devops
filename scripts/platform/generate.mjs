import { generate } from './lib.mjs';
try {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2);
    if (!args[i]?.startsWith('--') || !['name', 'owner', 'port', 'image'].includes(key) || args[i + 1] === undefined || key in options) throw new Error('Usage : --name equipe-demo --owner apprenant --port 3400 [--image référence-autorisée]');
    options[key] = args[i + 1];
  }
  console.log(JSON.stringify(await generate(options), null, 2));
} catch (error) { console.error(`Demande refusée : ${error.message}`); process.exitCode = 1; }
