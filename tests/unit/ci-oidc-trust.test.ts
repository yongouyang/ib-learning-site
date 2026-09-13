import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Static guard for the deploy role's OIDC trust (the *-iam.test.ts precedent:
// plain-text assertions, no AWS). A job that declares `environment:` is issued
// sub `repo:…:environment:<NAME>` INSTEAD of `repo:…:ref:refs/heads/<branch>`
// (GitHub docs, "Filtering for a specific branch"), so a new environment in
// ci.yml that nobody added to modules/ci makes every deploy fail with
// "Not authorized to perform sts:AssumeRoleWithWebIdentity" — which is exactly
// what happened in 2026-09-14.

const ciYml = readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const ciTf = readFileSync(path.join(process.cwd(), 'terraform/modules/ci/main.tf'), 'utf8');

const workflowEnvironments = [...ciYml.matchAll(/^\s*environment:\s*(\S+)\s*$/gm)].map((m) => m[1]);

describe('deploy role OIDC trust (static)', () => {
  it('finds the environments the deploy jobs declare', () => {
    expect(workflowEnvironments).toEqual(['DEV', 'PROD']);
  });

  it('trusts every environment declared in ci.yml', () => {
    const list = ciTf.slice(ciTf.indexOf('variable "github_environments"'));
    const defaults = list.slice(list.indexOf('default'), list.indexOf('}'));
    for (const env of workflowEnvironments) {
      expect(defaults).toContain(`"${env}"`);
    }
  });

  it('trusts both the environment form and the branch form of the sub claim', () => {
    const condition = ciTf.slice(ciTf.indexOf('token.actions.githubusercontent.com:sub'));
    expect(condition).toContain('repo:${var.github_repo}:ref:refs/heads/${b}');
    expect(condition).toContain('repo:${var.github_repo}:environment:${e}');
    // The deploy jobs no longer use the branch form, so dropping the concat
    // (or the environment half) is the regression to catch.
    expect(condition).toContain('concat(');
  });
});
