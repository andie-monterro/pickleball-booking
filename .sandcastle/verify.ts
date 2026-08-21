// Smoke-tests the sandbox without spending a single agent token.
//
// It builds the same sandbox the real loop uses, then runs the commands the
// agents depend on: the Linear CLI, the type checker, and the test suite
// against the shared Postgres. Run this after changing the Dockerfile, the
// test setup, or the credentials in .sandcastle/.env.
//
// Usage:
//   npm run sandcastle:verify

import { execFileSync } from "node:child_process";
import { createSandbox } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

const BRANCH = "sandcastle/verify";
const NETWORK = "sandcastle-pickleball";
const POSTGRES_CONTAINER = "sandcastle-pickleball-postgres";
const TEST_PG_ADMIN_URL = `postgres://postgres:postgres@${POSTGRES_CONTAINER}:5432/postgres`;

const CHECKS = [
  "node --version",
  "gh --version",
  "git config --global --get credential.https://github.com.helper",
  "node scripts/linear.mjs list",
  "npm run typecheck",
  "npm test",
];

const sandbox = await createSandbox({
  branch: BRANCH,
  sandbox: docker({ network: NETWORK, env: { TEST_PG_ADMIN_URL } }),
  hooks: { sandbox: { onSandboxReady: [{ command: "npm install" }] } },
  copyToWorktree: ["node_modules"],
});

let failures = 0;

try {
  for (const command of CHECKS) {
    const result = await sandbox.exec(command);
    const output = (result.stdout + result.stderr).trim().split("\n");
    const tail = output.slice(-3).join("\n  ");

    if (result.exitCode === 0) {
      console.log(`✓ ${command}\n  ${tail}\n`);
    } else {
      failures++;
      console.log(`✗ ${command} (exit ${result.exitCode})\n  ${tail}\n`);
    }
  }
} finally {
  await sandbox.close();
  // The verify branch holds no work — drop it so it never shows up in a plan.
  try {
    execFileSync("git", ["branch", "-D", BRANCH], { stdio: "ignore" });
  } catch {
    // Already gone, or never created because the sandbox failed to start.
  }
}

console.log(
  failures === 0
    ? "Sandbox is ready."
    : `${failures} check(s) failed — the loop will hit the same problem.`,
);
process.exit(failures === 0 ? 0 : 1);
