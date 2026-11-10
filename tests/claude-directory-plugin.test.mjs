// claude-directory/postey is the plugin submitted to the Claude directory
// (claude.ai/directory/manage). Postey is not a Verified organization there, and
// Anthropic has no way to apply, so the directory refuses a plugin that ships a
// script, an allowed-tools grant beyond Read/Grep/Glob/LS, or frontmatter keys
// outside its list. The hub (skills/postey) ships the CLI and stays everywhere
// else; this folder is the markdown-only build of it, and these tests keep it so.

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(ROOT, 'claude-directory', 'postey');
const HUB = path.join(ROOT, 'skills', 'postey');

const ALLOWED_EXT = new Set(['.md', '.json', '.yaml', '.yml', '.png', '.txt']);
// Keys that passed the directory's frontmatter check on quantplay/skills.
const ALLOWED_FRONTMATTER = new Set(['name', 'version', 'description', 'when_to_use']);

const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		return e.isDirectory() ? walk(p) : [p];
	});
const json = (rel) => JSON.parse(fs.readFileSync(path.join(PLUGIN, rel), 'utf8'));
const rel = (p) => path.relative(PLUGIN, p);

test('ships only file types the directory accepts', () => {
	for (const file of walk(PLUGIN)) {
		assert.ok(ALLOWED_EXT.has(path.extname(file)), `${rel(file)}: not an accepted file type`);
		const head = fs.readFileSync(file).subarray(0, 2).toString();
		assert.notStrictEqual(head, '#!', `${rel(file)}: starts with #!`);
	}
});

test('skill frontmatter uses only accepted keys and grants no tools', () => {
	for (const file of walk(PLUGIN).filter((p) => path.basename(p) === 'SKILL.md')) {
		const front = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf8'));
		assert.ok(front, `${rel(file)}: no frontmatter`);
		for (const [, key] of front[1].matchAll(/^([A-Za-z_-]+):/gm)) {
			assert.ok(ALLOWED_FRONTMATTER.has(key), `${rel(file)}: frontmatter key '${key}'`);
		}
	}
});

test('connects the same hosted server as the hub, with only accepted fields', () => {
	assert.deepStrictEqual(json('.mcp.json'), JSON.parse(fs.readFileSync(path.join(HUB, '.mcp.json'), 'utf8')));
	for (const server of Object.values(json('.mcp.json').mcpServers)) {
		assert.deepStrictEqual(Object.keys(server).sort(), ['type', 'url']);
	}
});

test('the manifest names the skill folder and an icon that exists', () => {
	const manifest = json('.claude-plugin/plugin.json');
	assert.strictEqual(manifest.name, 'postey');
	assert.ok(fs.existsSync(path.join(PLUGIN, manifest.skills, 'postey', 'SKILL.md')));
	assert.ok(fs.statSync(path.join(PLUGIN, manifest.icon)).size > 0);
});

test('the craft references are byte-identical copies of the hub', () => {
	const dir = path.join(PLUGIN, 'skills', 'postey', 'references');
	for (const name of fs.readdirSync(dir)) {
		assert.ok(
			fs.readFileSync(path.join(dir, name)).equals(fs.readFileSync(path.join(HUB, 'references', name))),
			`references/${name} drifted from skills/postey/references/${name}: copy it again`
		);
	}
});

test('every relative link in the skill resolves inside the plugin', () => {
	for (const file of walk(PLUGIN).filter((p) => p.endsWith('.md'))) {
		for (const [, target] of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
			if (/^[a-z]+:/.test(target)) continue;
			const resolved = path.resolve(path.dirname(file), target);
			assert.ok(resolved.startsWith(PLUGIN) && fs.existsSync(resolved), `${rel(file)}: link ${target}`);
		}
	}
});
