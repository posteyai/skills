import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync(
	new URL('../skills/postey/references/mcp-authentication.md', import.meta.url),
	'utf8'
);

function section(heading) {
	const start = doc.indexOf(`## ${heading}\n`);
	assert.notEqual(start, -1, `Missing ${heading} section`);
	const end = doc.indexOf('\n## ', start + 1);
	return doc.slice(start, end === -1 ? undefined : end);
}

for (const staleAdvice of ['Two mint paths remain', 'That is wrong', 'insufficient_scope']) {
	test(`authentication reference removes stale advice: ${staleAdvice}`, () => {
		assert.ok(!doc.includes(staleAdvice), `Remove obsolete advice: ${staleAdvice}`);
	});
}

test('agent-token minting requires a browser session and keeps its anchor', () => {
	assert.match(section('Agent tokens'), /browser session/i);
	assert.ok(doc.includes('(#agent-tokens)'), 'Keep the agent-token link');
});

test('API-key creation requires a signed-in browser session and keeps its anchor', () => {
	assert.match(section('API key'), /signed-in browser session/i);
	assert.ok(doc.includes('(#api-key)'), 'Keep the API-key link');
});

test('enforced MCP grant denials are tool errors inside HTTP 200 responses', () => {
	const oauth = section('OAuth scopes');
	assert.match(oauth, /when grants are enforced/i);
	assert.match(oauth, /ToolError/);
	assert.match(oauth, /permission_denied/i);
	assert.match(oauth, /HTTP 200/);
});
