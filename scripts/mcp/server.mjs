import { createHandler } from './handler.mjs';
const handle = createHandler();
const MAX_BYTES = 8192, MAX_MESSAGES = 256;
let pending = Buffer.alloc(0), messages = 0;
const send = value => { if (value !== null) process.stdout.write(JSON.stringify(value) + '\n'); };
for await (const chunk of process.stdin) {
  pending = Buffer.concat([pending, chunk]);
  let newline;
  while ((newline = pending.indexOf(10)) !== -1) {
    const line = pending.subarray(0, newline);
    pending = pending.subarray(newline + 1);
    if (line.length > MAX_BYTES || ++messages > MAX_MESSAGES) {
      send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Limite du laboratoire dépassée ; session fermée.' } });
      process.exitCode = 1; process.stdin.destroy(); break;
    }
    try { send(await handle(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line)))); }
    catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Message JSON illisible.' } }); }
  }
  if (process.exitCode || pending.length > MAX_BYTES) {
    if (!process.exitCode) send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Message trop volumineux ; session fermée.' } });
    process.exitCode = 1; process.stdin.destroy(); break;
  }
}
if (!process.exitCode && pending.length) {
  send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Message incomplet en fin de flux.' } });
  process.exitCode = 1;
}
