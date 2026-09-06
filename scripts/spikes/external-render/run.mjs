import { build } from 'esbuild';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = process.cwd();
const out = resolve(root, 'build/external-render-spike');
const evidence = resolve(root, 'docs/research/external-render-service/evidence');
await mkdir(out, { recursive: true }); await mkdir(evidence, { recursive: true });
for (const name of ['route', 'raster', 'reference']) {
  await build({ entryPoints: [`scripts/spikes/external-render/${name}.ts`], bundle: true,
    packages: 'external', platform: 'node', format: 'cjs', outfile: `${out}/${name}.cjs`, logLevel: 'silent' });
}
const graph = await build({ entryPoints: ['scripts/spikes/external-render/worker-preparation.ts'],
  bundle: true, platform: 'browser', format: 'esm', outfile: `${out}/worker-preparation.mjs`, metafile: true, logLevel: 'silent' });
const inputs = Object.keys(graph.metafile.inputs);
assert(!inputs.some(path => /next[\/]og|satori|resvg|editor[\/]fonts|raster\.ts/.test(path)));
const { createRenderer, LIMITS } = require(`${out}/route.cjs`);
const { reference, SIZE_PRESETS, adaptTemplateToSize } = require(`${out}/reference.cjs`);
const { prepare } = await import(`${out}/worker-preparation.mjs`);
const token = randomBytes(24).toString('hex');
const workerPath = `${out}/raster.cjs`;
let service = createRenderer({ token, workerPath });
const server = createServer(async (incoming, outgoing) => {
  const controller = new AbortController();
  outgoing.on('close', () => { if (!outgoing.writableEnded) controller.abort(); });
  try {
    const request = new Request('http://localhost/v1/render', { method: incoming.method, headers: incoming.headers,
      body: incoming, duplex: 'half', signal: controller.signal });
    const response = await service.POST(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end('spike failure'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const url = `http://127.0.0.1:${server.address().port}/v1/render`;
const fixtureImage = await sharp({ create: { width: 320, height: 240, channels: 4, background: '#aaddcc' } })
  .composite([{ input: Buffer.from('<svg width="320" height="240"><rect x="60" y="35" width="200" height="170" rx="30" fill="#245c4e"/><circle cx="160" cy="120" r="45" fill="#fff4c0"/></svg>') }])
  .png().toBuffer();
const base = {
  id: 'synthetic-template', name: 'Native Next spike', sizeId: '1:1', width: 1080, height: 1080,
  background: '#faf8f0', revision: 1, createdAt: 1, updatedAt: 1,
  layers: [
    { id: 'image', name: 'Image', type: 'product-image', x: 80, y: 50, w: 920, h: 620, z: 0, rotation: 0,
      visible: true, locked: false, style: { borderRadius: 24, background: '#ffffff' }, objectFit: 'contain' },
    { id: 'title', name: 'Long title', type: 'text', x: 70, y: 740, w: 940, h: 190, z: 1, rotation: 2,
      visible: true, locked: false, content: '{{title}}', style: { color: '#183e32', fontSize: 44, fontWeight: 700, lineHeight: 1.2, opacity: 0.9 } },
    { id: 'price', name: 'Sale', type: 'badge', x: 70, y: 930, w: 940, h: 90, z: 2, rotation: 0,
      visible: true, locked: false, content: '{{price}} | {{discount_pct}}% OFF', style: { background: '#f7cc68', color: '#183e32', fontSize: 36, fontWeight: 600, borderRadius: 12 } },
  ],
};
const product = { id: 'fixture-one', source_id: 'csv:row:1', title: 'Handmade ceramic cup with a long descriptive title that wraps across multiple lines',
  description: 'Synthetic product; no merchant data.', price: '25.00 EUR', sale_price: '19.00 EUR', availability: 'in stock', condition: 'new',
  link: 'https://example.com/fixture', image_link: `data:image/png;base64,${fixtureImage.toString('base64')}`, brand: 'Synthetic' };
function job(size) { return { schemaVersion: 1, rendererVersion: 1, requestId: 'synthetic-benchmark',
  template: { ...adaptTemplateToSize(base, size), updatedAt: 1 }, product, width: size.width, height: size.height }; }
const results = { measuredAt: new Date().toISOString(), environment: { node: process.version, next: require('next/package.json').version, platform: process.platform, architecture: process.arch },
  scope: 'Local HTTP native Next ImageResponse; synthetic embedded PNG; NOT hosted cold-start, deployed Worker CPU or R2 evidence',
  limits: LIMITS, workerPreparationInputs: inputs, samples: {}, safety: {}, preparation: {} };
function percentile(values, q) { return [...values].sort((a,b) => a-b)[Math.ceil(values.length*q)-1]; }
async function send(value, options={}) {
  const start = performance.now();
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    body: options.raw ?? JSON.stringify(value), signal: options.signal });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes, wallMs: performance.now()-start };
}
try {
  for (const size of SIZE_PRESETS) {
    await service.close(); service = createRenderer({ token, workerPath });
    const input = job(size);
    console.log(`Measuring ${size.id}: baseline`);
    const baseline = Buffer.from(await reference(input));
    console.log(`Measuring ${size.id}: HTTP samples`);
    const baselinePixels = await sharp(baseline).ensureAlpha().raw().toBuffer();
    const samples = [];
    for (let i=0;i<11;i++) {
      const result = await send(input);
      assert.equal(result.response.status,200);
      assert.equal(result.response.headers.get('content-type'),'image/png');
      const meta = await sharp(result.bytes).metadata();
      assert.equal(meta.width,size.width); assert.equal(meta.height,size.height);
      assert.deepEqual(await sharp(result.bytes).ensureAlpha().raw().toBuffer(), baselinePixels);
      samples.push({ kind: i===0?'fresh-raster-worker':'warm', wallMs: result.wallMs,
        renderMs: Number(result.response.headers.get('x-spike-render-ms')),
        processCpuMs: Number(result.response.headers.get('x-spike-cpu-ms')),
        rssBytes: Number(result.response.headers.get('x-spike-rss-bytes')), pngBytes: result.bytes.length,
        exactPngBytes: result.bytes.equals(baseline) });
      if(i===0) await writeFile(`${evidence}/${size.id.replaceAll(':','-')}.png`, result.bytes);
    }
    const missing = { ...input, product: { ...product, image_link: '' } };
    const missingActual = await send(missing);
    assert.equal(missingActual.response.status,200);
    assert.deepEqual(await sharp(missingActual.bytes).ensureAlpha().raw().toBuffer(), await sharp(Buffer.from(await reference(missing))).ensureAlpha().raw().toBuffer());
    results.samples[size.id] = { payloadBytes: Buffer.byteLength(JSON.stringify(input)), samples,
      warmP50Ms: percentile(samples.slice(1).map(s=>s.wallMs),.5), warmP95Ms: percentile(samples.slice(1).map(s=>s.wallMs),.95),
      missingImageParity: true, rgbaSha256: createHash('sha256').update(baselinePixels).digest('hex') };
    console.log(`PASS ${size.id}: fresh ${samples[0].wallMs.toFixed(1)} ms; warm p95 ${results.samples[size.id].warmP95Ms.toFixed(1)} ms; exact pixels 11/11`);
  }
  const input = job(SIZE_PRESETS[0]);
  const cases = [
    ['unauthorized', input, { headers: { Authorization: 'Bearer invalid' } }, 401],
    ['malformedJson', input, { raw: '{' },400],
    ['oversizedBody', input, { raw: 'x'.repeat(LIMITS.jsonBytes+1) },413],
    ['unsupportedDimensions', {...input,width:1}, {},422],
    ['unsupportedVersion', {...input,rendererVersion:999}, {},422],
    ['remoteImageDenied', {...input,product:{...product,image_link:'https://127.0.0.1/image'}}, {},422],
    ['oversizedLayerCount', {...input,template:{...input.template,layers:Array(101).fill(input.template.layers[0])}}, {},422],
  ];
  for(const [name,data,options,status] of cases) { const result = await send(data,options); assert.equal(result.response.status,status); results.safety[name]=status; }
  await service.close(); service=createRenderer({token,workerPath});
  const burst = await Promise.all([send(input),send(input)]);
  assert.deepEqual(burst.map(r=>r.response.status).sort(),[200,429]);
  results.safety.concurrentBurst = {statuses:burst.map(r=>r.response.status), ...service.stats()};
  // A hung worker demonstrates hard termination and slot recovery, without a test-only HTTP hook.
  await writeFile(`${out}/hung.cjs`, "require('node:worker_threads').parentPort.on('message', () => { while(true) {} });");
  const hung = createRenderer({token,workerPath:`${out}/hung.cjs`,deadlineMs:100});
  const direct = (signal) => new Request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal});
  const timed = await hung.POST(direct()); assert.equal(timed.status,504); assert.equal(hung.stats().active,0); assert.equal(hung.stats().terminations,1);
  results.safety.hardDeadline = {status:timed.status,...hung.stats()}; await hung.close();
  const aborter = new AbortController();
  const cancelled = createRenderer({token,workerPath:`${out}/hung.cjs`});
  const pending=cancelled.POST(direct(aborter.signal)); setTimeout(()=>aborter.abort(),100);
  assert.equal((await pending).status,499); assert.equal(cancelled.stats().active,0);
  results.safety.cancel = cancelled.stats(); await cancelled.close();
  for(const count of [31,250]) {
    const raw=JSON.stringify({template:base,products:Array.from({length:count},(_,i)=>({...product,image_link:'https://example.com/image.png',id:`fixture-${i}`,source_id:`csv:row:${i}`}))});
    const times=[];for(let i=0;i<30;i++){const t=performance.now();await prepare(raw,`csv:row:${count-1}`);times.push(performance.now()-t);}
    results.preparation[count]={snapshotBytes:Buffer.byteLength(raw),localP50Ms:percentile(times,.5),localP95Ms:percentile(times,.95),scope:'Node wall time only; no R2/network/PNG validation/deployed CPU claim'};
  }
  await writeFile(`${evidence}/local-results.json`,JSON.stringify(results,null,2)+'\n');
  console.log('PASS auth, validation, bounded concurrency, hard timeout/cancellation, missing-image parity; results saved.');
} finally { await service.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
