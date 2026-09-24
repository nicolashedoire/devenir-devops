import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { VERSION } from './handler.mjs';
export async function connect() {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map(); let next = 1, stopped = false, diagnostics = '';
  const exit = new Promise(resolve => child.once('exit', (code, signal) => { stopped = true; resolve({ code, signal }); }));
  child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4096); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let value; try { value = JSON.parse(line); } catch { child.kill('SIGTERM'); return; }
    const waiter = pending.get(value.id);
    if (waiter) { clearTimeout(waiter.timer); pending.delete(value.id); waiter.resolve(value); }
  });
  child.on('error', error => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(error); } pending.clear(); });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => { pending.delete(id); child.kill('SIGTERM'); reject(new Error('Délai MCP dépassé (3 secondes).')); }, 3000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const initialized = await request('initialize', { protocolVersion: VERSION, capabilities: {}, clientInfo: { name: 'taskboard-lab-client', version: '1.0.0' } });
  if (initialized.error || initialized.result?.protocolVersion !== VERSION || !initialized.result?.capabilities?.tools) { child.kill('SIGTERM'); throw new Error('Négociation MCP incompatible.'); }
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  return { initialized, request, async close() {
    if (!stopped) child.stdin.end();
    const timer = setTimeout(() => child.kill('SIGTERM'), 3000);
    const status = await exit; clearTimeout(timer); lines.close();
    if (status.code !== 0) throw new Error(`Serveur MCP arrêté anormalement : ${diagnostics || status.signal || status.code}`);
    return status;
  } };
}
