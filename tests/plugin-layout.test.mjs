// Every skills/<name>/ folder must stay a plain skill folder, because ClawHub's
// `skill publish` refuses a folder holding any of these ("This looks like a
// plugin"). The Claude Code plugin is defined by the folder's marketplace entry
// instead (`strict: false`, no plugin.json), and Claude Code loads a source
// whose root holds SKILL.md as a single skill.

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Mirrors looksLikePluginFolder() in the clawhub CLI, plus .mcp.json, which
// ClawHub's package detection counts as a bundle marker.
const PLUGIN_MARKERS = [
	'openclaw.plugin.json',
	'.claude-plugin/plugin.json',
	'.codex-plugin/plugin.json',
	'.cursor-plugin/plugin.json',
	'.mcp.json'
];

/** Pure, so fixtures can drive it. `root` is a repo-shaped directory. */
export function checkPluginLayout(root) {
	const problems = [];
	const skillsDir = path.join(root, 'skills');
	const folders = fs
		.readdirSync(skillsDir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
		.map((e) => e.name);
	if (folders.length === 0) return ['no skill folders under skills/ — nothing to check'];

	for (const name of folders) {
		const dir = path.join(skillsDir, name);
		for (const marker of PLUGIN_MARKERS) {
			if (fs.existsSync(path.join(dir, marker))) {
				problems.push(`skills/${name}/${marker}: ClawHub refuses a skill folder that carries it`);
			}
		}
		const pkg = path.join(dir, 'package.json');
		if (fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, 'utf8')).openclaw) {
			problems.push(`skills/${name}/package.json declares "openclaw", which ClawHub reads as a plugin`);
		}
	}

	const market = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
	const entries = market.plugins ?? [];
	for (const name of folders.filter((n) => !n.startsWith('_'))) {
		const entry = entries.find((p) => p.source === `./skills/${name}`);
		if (!entry) {
			problems.push(`skills/${name} has no marketplace entry, so it cannot be installed as a plugin`);
			continue;
		}
		if (entry.name !== name) problems.push(`entry for skills/${name} is named '${entry.name}'`);
		if (entry.strict !== false) {
			problems.push(`entry '${entry.name}' must set "strict": false — it is the plugin's only manifest`);
		}
	}
	return problems;
}

const FIXTURES = [];
process.on('exit', () => {
	for (const d of FIXTURES) fs.rmSync(d, { recursive: true, force: true });
});

function fixture({ extra = {}, entry = {} } = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'postey-layout-'));
	FIXTURES.push(root);
	const files = {
		'skills/alpha/SKILL.md': '---\nname: alpha\n---\n',
		'.claude-plugin/marketplace.json': JSON.stringify({
			plugins: [{ name: 'alpha', source: './skills/alpha', strict: false, ...entry }]
		}),
		...extra
	};
	for (const [rel, body] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), body);
	}
	return root;
}

test('the shipped tree passes', () => {
	assert.deepStrictEqual(checkPluginLayout(ROOT), []);
});

test('a clean fixture passes', () => {
	assert.deepStrictEqual(checkPluginLayout(fixture()), []);
});

for (const marker of PLUGIN_MARKERS) {
	test(`a skill folder carrying ${marker} FAILS`, () => {
		const problems = checkPluginLayout(fixture({ extra: { [`skills/alpha/${marker}`]: '{}' } }));
		assert.ok(problems.some((p) => p.includes(marker)), problems.join('\n'));
	});
}

test('the template is held to the same rule, since ClawHub can still see it', () => {
	const problems = checkPluginLayout(
		fixture({ extra: { 'skills/_template/SKILL.md': 'x', 'skills/_template/.claude-plugin/plugin.json': '{}' } })
	);
	assert.ok(problems.some((p) => p.startsWith('skills/_template/')), problems.join('\n'));
});

test('a package.json with an openclaw block FAILS', () => {
	const problems = checkPluginLayout(fixture({ extra: { 'skills/alpha/package.json': '{"openclaw":{}}' } }));
	assert.ok(problems.some((p) => /openclaw/.test(p)));
});

test('a skill with no marketplace entry FAILS', () => {
	const problems = checkPluginLayout(fixture({ extra: { 'skills/beta/SKILL.md': 'x' } }));
	assert.ok(problems.some((p) => /skills\/beta has no marketplace entry/.test(p)));
});

test('an entry left strict FAILS', () => {
	const problems = checkPluginLayout(fixture({ entry: { strict: true } }));
	assert.ok(problems.some((p) => /strict/.test(p)));
});
