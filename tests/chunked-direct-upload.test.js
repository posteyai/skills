const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CLI_PATH = path.resolve(__dirname, '..', 'skills', 'postey', 'scripts', 'postey.js');
const MB = 1024 * 1024;

// One local server plays both the Postey API and S3. Nothing leaves the machine.
function startServer({ etag }) {
  const log = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    try {
      for await (const c of req) chunks.push(c);
    } catch {
      return; // the CLI exited mid-request (expected when it fails fast)
    }
    const body = Buffer.concat(chunks);
    const entry = { method: req.method, path: req.url, headers: req.headers, size: body.length };
    log.push(entry);
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.url === '/media/chunked/init/direct') {
      entry.json = JSON.parse(body.toString());
      const base = `http://127.0.0.1:${server.address().port}`;
      return json(201, {
        upload_id: 'up1',
        chunk_size: 30 * MB,
        total_chunks: 2,
        presigned_urls: [1, 2].map((n) => ({ part_number: n, upload_url: `${base}/s3/part${n}?sig=x` })),
      });
    }
    if (req.url.startsWith('/s3/')) {
      res.writeHead(200, etag ? { ETag: `"etag-${req.url.includes('part1') ? 1 : 2}"` } : {});
      return res.end();
    }
    if (req.url === '/media/chunked/up1/progress') {
      entry.json = JSON.parse(body.toString());
      return json(200, {});
    }
    if (req.url === '/media/chunked/up1/complete') return json(200, { media_id: 'done' });
    return json(500, { error: 'unexpected', url: req.url });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, log, baseUrl: `http://127.0.0.1:${server.address().port}` })),
  );
}

function runUpload(baseUrl, file, home) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_PATH, 'media:upload', '--file', file, '--platform', 'X'], {
      env: { ...process.env, HOME: home, POSTEY_API_KEY: 'test_key', POSTEY_API_BASE: baseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('close', (code) => resolve({ code, stdout }));
  });
}

async function withFixture(opts, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-upload-'));
  const file = path.join(dir, 'big.mp4');
  fs.writeFileSync(file, '');
  fs.truncateSync(file, 50 * MB + 1); // sparse, just over the chunked threshold
  const srv = await startServer(opts);
  try {
    await fn({ ...srv, file, dir });
  } finally {
    srv.server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('large uploads go init/direct, S3 PUTs, progress, complete', async () => {
  await withFixture({ etag: true }, async ({ baseUrl, log, file, dir }) => {
    const r = await runUpload(baseUrl, file, dir);
    assert.equal(r.code, 0, r.stdout);
    const seq = log.map((e) => `${e.method} ${e.path.split('?')[0]}`);
    assert.equal(seq[0], 'POST /media/chunked/init/direct');
    assert.deepEqual(seq.filter((s) => s.startsWith('PUT ')).sort(), ['PUT /s3/part1', 'PUT /s3/part2']);
    assert.equal(seq.filter((s) => s === 'PATCH /media/chunked/up1/progress').length, 2);
    assert.equal(seq[seq.length - 1], 'POST /media/chunked/up1/complete');
    // parts upload in parallel, so only per-part order is fixed: PUT n, then progress n
    for (const n of [1, 2]) {
      const put = seq.indexOf(`PUT /s3/part${n}`);
      const prog = log.findIndex((e) => e.path.endsWith('/progress') && e.json.part_number === n);
      assert.ok(put >= 0 && prog > put, `progress ${n} must follow PUT ${n}`);
      assert.equal(log[prog].json.etag, `etag-${n}`);
    }
    assert.equal(log[0].json.doc_id, 0);
    assert.ok(log[0].headers.authorization || log[0].headers['x-api-key'], 'init/direct is authenticated');
    assert.equal(JSON.parse(r.stdout).media_id, 'done');
  });
});

test('S3 PUTs carry no Authorization or API key header', async () => {
  await withFixture({ etag: true }, async ({ baseUrl, log, file, dir }) => {
    await runUpload(baseUrl, file, dir);
    const puts = log.filter((e) => e.method === 'PUT');
    assert.equal(puts.length, 2);
    for (const p of puts) {
      assert.equal(p.headers.authorization, undefined);
      assert.equal(p.headers['x-api-key'], undefined);
      assert.equal(p.headers['content-type'], undefined);
    }
  });
});

test('a missing ETag fails the upload and never completes', async () => {
  await withFixture({ etag: false }, async ({ baseUrl, log, file, dir }) => {
    const r = await runUpload(baseUrl, file, dir);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /No ETag received/);
    assert.ok(!log.some((e) => e.path.endsWith('/complete')));
  });
});
