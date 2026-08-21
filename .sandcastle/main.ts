// Sandcastle loop for this repo — plan, implement, review, open PRs.
//
// One run does four phases:
//   Phase 0 (Test database): ensures a long-lived Postgres container and the
//                            Docker network the sandboxes join. The sandboxes
//                            have no Docker daemon of their own, so the test
//                            suite reaches this server through
//                            TEST_PG_ADMIN_URL and carves out a throwaway
//                            database per run (tests/setup/global-setup.ts).
//   Phase 1 (Plan):          one agent reads the Linear tickets labelled
//                            `ready-for-agent`, works out which ones can be
//                            built at the same time, and emits a <plan>.
//   Phase 2 (Implement +     one sandbox per ticket, all running at the same
//            Review):        time. The implementer commits on its own branch;
//                            if it committed, a reviewer runs in the same
//                            sandbox on the same branch.
//   Phase 3 (Pull requests): one agent pushes each finished branch, opens a
//                            PR, and reports back on the Linear ticket.
//                            Nothing is merged — a human decides that.
//
// Usage:
//   npm run sandcastle
// Read the logs under .sandcastle/logs/ while it runs.

import { execFileSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { z } from "zod";

// The planner emits its plan as JSON inside <plan> tags; Output.object extracts
// and validates it against this schema.
const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// One plan→implement→PR cycle per invocation. Raise it to let a single run pick
// up tickets that only became unblocked once earlier branches landed — which
// only helps if this loop merges, and by design it does not.
const MAX_ITERATIONS = 1;

// Most tickets one run will start at once. The planner may pick fewer when
// tickets overlap, never more. Each ticket costs one Opus implementer, so this
// is the main cost dial in this file.
const MAX_TICKETS = 3;

// Ceiling on implementer turns per ticket. The implementer normally stops
// earlier by emitting <promise>COMPLETE</promise>.
const MAX_IMPLEMENT_ITERATIONS = 100;

// Planning and implementation get the strongest model; review and the
// mechanical PR phase get the cheaper one.
const PLANNER_MODEL = "claude-opus-5";
const IMPLEMENTER_MODEL = "claude-opus-5";
const REVIEWER_MODEL = "claude-sonnet-5";
const PR_MODEL = "claude-sonnet-5";

// Shared test database. Every sandbox joins NETWORK and reaches Postgres by
// container name; the published port lets you run the suite the same way from
// the host: TEST_PG_ADMIN_URL=postgres://postgres:postgres@localhost:5433/postgres npm test
const NETWORK = "sandcastle-pickleball";
const POSTGRES_CONTAINER = "sandcastle-pickleball-postgres";
const POSTGRES_IMAGE = "postgres:17-alpine";
const POSTGRES_HOST_PORT = "5433";
const TEST_PG_ADMIN_URL = `postgres://postgres:postgres@${POSTGRES_CONTAINER}:5432/postgres`;

// Hooks run inside the sandbox before the agent starts each iteration.
// npm install covers platform-specific binaries and anything added since the
// host node_modules snapshot was copied in.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "npm install" }] },
};

// Copy node_modules from the host into the worktree before each sandbox starts,
// so the install above is a top-up rather than a cold install.
const copyToWorktree = ["node_modules"];

// Every sandbox in this run gets the same network and test-database wiring.
const sandbox = () =>
  docker({ network: NETWORK, env: { TEST_PG_ADMIN_URL } });

// ---------------------------------------------------------------------------
// Phase 0: the shared test database
// ---------------------------------------------------------------------------

function dockerOut(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function ensureTestPostgres(): Promise<void> {
  const networks = dockerOut("network", "ls", "--format", "{{.Name}}").split("\n");
  if (!networks.includes(NETWORK)) {
    dockerOut("network", "create", NETWORK);
    console.log(`Created Docker network ${NETWORK}.`);
  }

  const state = dockerOut(
    "ps",
    "-a",
    "--filter",
    `name=^${POSTGRES_CONTAINER}$`,
    "--format",
    "{{.State}}",
  );

  if (state === "") {
    dockerOut(
      "run",
      "-d",
      "--name",
      POSTGRES_CONTAINER,
      "--network",
      NETWORK,
      "-e",
      "POSTGRES_PASSWORD=postgres",
      "-p",
      `${POSTGRES_HOST_PORT}:5432`,
      POSTGRES_IMAGE,
    );
    console.log(`Started test Postgres container ${POSTGRES_CONTAINER}.`);
  } else if (state !== "running") {
    dockerOut("start", POSTGRES_CONTAINER);
    console.log(`Restarted test Postgres container ${POSTGRES_CONTAINER}.`);
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      dockerOut("exec", POSTGRES_CONTAINER, "pg_isready", "-U", "postgres");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${POSTGRES_CONTAINER} did not become ready in 60s.`);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

await ensureTestPostgres();

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planner reads the open Linear tickets through scripts/linear.mjs,
  // builds a dependency graph, and selects the tickets that can be built at
  // the same time without fighting over the same files.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    // No install hook here: this phase runs on the human's own checkout, and
    // `npm install` inside the Linux container would swap the host's macOS
    // binaries for Linux ones. The planner only reads files and calls
    // scripts/linear.mjs, which needs no dependencies.
    sandbox: sandbox(),
    name: "planner",
    // One iteration is enough: the planner reads and reasons, it does not
    // write code. (Structured output requires maxIterations: 1.)
    maxIterations: 1,
    agent: sandcastle.claudeCode(PLANNER_MODEL),
    promptFile: "./.sandcastle/plan-prompt.md",
    promptArgs: { MAX_TICKETS: String(MAX_TICKETS) },
    // Extract and validate the <plan> JSON into a typed object. Throws
    // StructuredOutputError if the tag is missing or the JSON is malformed,
    // which aborts the run.
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const issues = plan.output.issues;

  if (issues.length === 0) {
    console.log("No unblocked tickets to work on. Exiting.");
    break;
  }

  console.log(`Planning complete. ${issues.length} ticket(s) in parallel:`);
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Implement + Review
  //
  // One sandbox per ticket, so the implementer and the reviewer share a
  // container and a branch. Promise.allSettled means one failing ticket does
  // not cancel the others.
  // -------------------------------------------------------------------------
  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandboxForIssue = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: sandbox(),
        hooks,
        copyToWorktree,
      });

      try {
        const implement = await sandboxForIssue.run({
          name: `implementer:${issue.id}`,
          maxIterations: MAX_IMPLEMENT_ITERATIONS,
          agent: sandcastle.claudeCode(IMPLEMENTER_MODEL),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Only review if the implementer produced commits.
        if (implement.commits.length > 0) {
          const review = await sandboxForIssue.run({
            name: `reviewer:${issue.id}`,
            maxIterations: 1,
            agent: sandcastle.claudeCode(REVIEWER_MODEL),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: { BRANCH: issue.branch },
          });

          // Each run() reports only its own commits, so merge both lists for
          // the PR phase.
          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandboxForIssue.close();
      }
    }),
  );

  // Log any pipeline that threw (network error, sandbox crash, timeout).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // A ticket only reaches the PR phase if it produced commits.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  console.log(
    `\nExecution complete. ${completedIssues.length} branch(es) with commits:`,
  );
  for (const issue of completedIssues) {
    console.log(`  ${issue.branch}`);
  }

  if (completedIssues.length === 0) {
    console.log("No commits produced. Nothing to open a PR for.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Pull requests
  //
  // One sandbox per finished branch, again in parallel. Each agent re-checks
  // the branch, pushes it, opens a PR against main, and comments the link on
  // the Linear ticket. Nothing is merged: a human reviews every PR.
  //
  // This runs in a worktree rather than on the human's checkout, so the tests
  // it runs cannot disturb the working tree or the host's node_modules.
  // -------------------------------------------------------------------------
  await Promise.allSettled(
    completedIssues.map(async (issue) => {
      const sandboxForPr = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: sandbox(),
        hooks,
        copyToWorktree,
      });

      try {
        await sandboxForPr.run({
          name: `pull-request:${issue.id}`,
          maxIterations: 1,
          agent: sandcastle.claudeCode(PR_MODEL),
          promptFile: "./.sandcastle/pr-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });
      } finally {
        await sandboxForPr.close();
      }
    }),
  );

  console.log("\nPull requests opened. Nothing was merged — review them by hand.");
}

console.log("\nAll done.");
