import { connect } from './client.mjs';
const proofId = process.argv[2] ?? 'temoin';
let session;
try {
  session = await connect();
  const tools = await session.request('tools/list');
  const catalogue = await session.request('tools/call', { name: 'catalogue_offres', arguments: {} });
  const proof = await session.request('tools/call', { name: 'lire_preuve', arguments: { id: proofId } });
  const refused = await session.request('tools/call', { name: 'lire_preuve', arguments: { id: '../../.env' } });
  if (tools.error || catalogue.error || proof.error || proof.result?.isError || refused.error?.code !== -32602) throw new Error('La preuve demandée n’est pas disponible ou le refus n’est pas conforme. Exécutez le jalon requis avant la démonstration.');
  const stopped = await session.close(); session = undefined;
  console.log(JSON.stringify({ event: 'mcp_demo_passed', protocol_version: '2025-11-25', tools: tools.result.tools.map(tool => tool.name), proof: JSON.parse(proof.result.content[0].text), out_of_scope_refused: true, clean_exit: stopped.code === 0, message: 'Échange MCP réel par stdio ; aucun modèle IA appelé et aucune donnée modifiée.' }, null, 2));
} catch (error) { console.error(`Démonstration interrompue : ${error.message}`); process.exitCode = 1; }
finally { if (session) await session.close().catch(() => {}); }
