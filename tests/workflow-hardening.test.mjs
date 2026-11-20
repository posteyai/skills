import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowsDir = new URL('../.github/workflows/', import.meta.url);
const workflows = fs.readdirSync(workflowsDir).filter((name) => name.endsWith('.yml')).sort();
assert.ok(workflows.length > 0, 'No workflow files found');

for (const name of workflows) {
	test(`${name} grants only contents: read in its top-level permissions`, () => {
		const workflow = fs.readFileSync(new URL(name, workflowsDir), 'utf8');
		const permissions = workflow.match(
			/^permissions:[ \t]*\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m
		);
		assert.ok(permissions, `${name} must declare top-level permissions`);
		assert.equal(permissions[1].trim(), 'contents: read');
	});
}
