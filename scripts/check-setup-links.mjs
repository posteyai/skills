// Verifies every URL in setup.md points at a live host. Prose cannot be
// unit-tested; an unreachable host is the one failure mode that can be.
//
// Deliberately NOT a 200-check. The MCP endpoint answers 405 to HEAD because it
// is POST-only, and the app's settings routes are client-rendered, so they 404
// on a HEAD too. Both prove DNS, TLS and reachability — which is what a setup
// doc's links actually need. Only a network error or a 5xx means something is
// really wrong. Do not "fix" this into a 200-check; it will fail on healthy infra.
//
// Not fetch(): app.postey.ai sends a ~17 KB `link: rel=modulepreload` header,
// over undici's fixed 16 KB limit, so fetch threw UND_ERR_HEADERS_OVERFLOW on a
// healthy 200 and the check reported the host UNREACHABLE. node:https takes a
// per-request maxHeaderSize on every Node version CI runs.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const MAX_HEADER_BYTES = 256 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

function head(url, redirectsLeft = MAX_REDIRECTS) {
	return new Promise((resolve, reject) => {
		const client = new URL(url).protocol === 'http:' ? http : https;
		const req = client.request(url, { method: 'HEAD', maxHeaderSize: MAX_HEADER_BYTES, timeout: TIMEOUT_MS }, (res) => {
			res.resume();
			const { statusCode, headers } = res;
			if (statusCode >= 300 && statusCode < 400 && headers.location) {
				if (redirectsLeft === 0) return reject(new Error('too many redirects'));
				return resolve(head(new URL(headers.location, url).href, redirectsLeft - 1));
			}
			resolve({ status: statusCode });
		});
		req.on('timeout', () => req.destroy(new Error(`timed out after ${TIMEOUT_MS}ms`)));
		req.on('error', reject);
		req.end();
	});
}

const md = readFileSync(new URL('../setup.md', import.meta.url), 'utf8');
const urls = [...md.matchAll(/https?:\/\/[^\s)<>"'`\]]+/g)].map((m) => m[0]);
const unique = [...new Set(urls)];

let failed = 0;
for (const url of unique) {
	let res;
	try {
		res = await head(url);
	} catch (err) {
		console.error(`UNREACHABLE  ${url}  (${err.code ?? err.message})`);
		failed++;
		continue;
	}
	if (res.status >= 500) {
		console.error(`SERVER ERROR ${res.status}  ${url}`);
		failed++;
	} else {
		console.log(`ok ${String(res.status).padEnd(3)}  ${url}`);
	}
}
console.log(`${unique.length - failed}/${unique.length} URLs reachable`);
process.exit(failed > 0 ? 1 : 0);
