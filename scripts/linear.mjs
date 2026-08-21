#!/usr/bin/env node
// Linear CLI — the tracker surface for sandboxed agents.
//
// Sandcastle agents run inside a container with no MCP servers and no browser,
// so they cannot use the `linear-monterro` MCP tools the interactive skills use.
// This script gives them the same operations over the Linear GraphQL API with
// nothing but a LINEAR_API_KEY, in roughly the shape of `gh issue`.
//
// Usage:
//   node scripts/linear.mjs list [--label ready-for-agent] [--project <uuid>]
//   node scripts/linear.mjs view AND-25
//   node scripts/linear.mjs comment AND-25 --body "text"
//   node scripts/linear.mjs comment AND-25 --body-file notes.md
//   node scripts/linear.mjs label AND-25 --add ready-for-human --remove ready-for-agent
//   node scripts/linear.mjs state AND-25 "In Progress"
//
// `list` and `view` print JSON on stdout. Mutations print one confirmation line.
// Any failure exits non-zero with the message on stderr.

import { readFileSync } from "node:fs";

const API_URL = "https://api.linear.app/graphql";

// Project "Pickleball Booking" — see docs/agents/issue-tracker.md.
const DEFAULT_PROJECT_ID = "32547f9b-790e-473a-af67-8eab300f62fa";

// Only issues a sandboxed agent is allowed to pick up.
const DEFAULT_LABEL = "ready-for-agent";

// Linear state types that count as "not finished yet".
const OPEN_STATE_TYPES = ["backlog", "unstarted", "started"];

async function graphql(query, variables) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    fail("LINEAR_API_KEY is not set.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    fail(`Linear API returned ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.errors) {
    fail(`Linear API error: ${JSON.stringify(payload.errors)}`);
  }
  return payload.data;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  url
  priority
  state { name type }
  labels { nodes { id name } }
  assignee { displayName }
  parent { identifier title }
  children { nodes { identifier } }
  comments { nodes { body createdAt user { displayName } } }
`;

function shapeIssue(issue) {
  return {
    id: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state?.name ?? null,
    priority: issue.priority,
    labels: issue.labels.nodes.map((label) => label.name),
    assignee: issue.assignee?.displayName ?? null,
    parent: issue.parent
      ? { id: issue.parent.identifier, title: issue.parent.title }
      : null,
    children: issue.children.nodes.map((child) => child.identifier),
    description: issue.description ?? "",
    comments: issue.comments.nodes.map((comment) => ({
      author: comment.user?.displayName ?? "unknown",
      createdAt: comment.createdAt,
      body: comment.body,
    })),
  };
}

// Resolves an `AND-25` style identifier. The `issue(id:)` query wants a UUID,
// so look the issue up by team key plus number instead.
async function fetchIssue(identifier) {
  const match = /^([A-Za-z]+)-(\d+)$/.exec(identifier.trim());
  if (!match) {
    fail(`Not a Linear issue identifier: ${identifier}`);
  }
  const [, teamKey, number] = match;

  const data = await graphql(
    `query Issue($teamKey: String!, $number: Float!) {
       issues(first: 1, filter: {
         team: { key: { eq: $teamKey } }
         number: { eq: $number }
       }) {
         nodes { ${ISSUE_FIELDS} }
       }
     }`,
    { teamKey: teamKey.toUpperCase(), number: Number(number) },
  );

  const issue = data.issues.nodes[0];
  if (!issue) {
    fail(`Issue not found: ${identifier}`);
  }
  return issue;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

// Issues a sandboxed agent may work on: open, correctly labelled, in the
// project, and a leaf. Parents (a spec issue with children, like AND-17) are
// containers for work, not work themselves.
async function list(flags) {
  const data = await graphql(
    `query Candidates($projectId: ID!, $label: String!, $states: [String!]!) {
       issues(
         first: 100
         orderBy: createdAt
         filter: {
           project: { id: { eq: $projectId } }
           labels: { name: { eq: $label } }
           state: { type: { in: $states } }
         }
       ) {
         nodes { ${ISSUE_FIELDS} }
       }
     }`,
    {
      projectId: flags.project ?? DEFAULT_PROJECT_ID,
      label: flags.label ?? DEFAULT_LABEL,
      states: OPEN_STATE_TYPES,
    },
  );

  const leaves = data.issues.nodes
    .filter((issue) => issue.children.nodes.length === 0)
    .map(shapeIssue);

  console.log(JSON.stringify(leaves, null, 2));
}

async function view(identifier) {
  console.log(JSON.stringify(shapeIssue(await fetchIssue(identifier)), null, 2));
}

async function comment(identifier, flags) {
  const body = flags["body-file"]
    ? readFileSync(flags["body-file"], "utf8")
    : flags.body;
  if (!body) {
    fail("Pass --body <text> or --body-file <path>.");
  }

  const issue = await fetchIssue(identifier);
  const data = await graphql(
    `mutation Comment($issueId: String!, $body: String!) {
       commentCreate(input: { issueId: $issueId, body: $body }) {
         success
         comment { url }
       }
     }`,
    { issueId: issue.id, body },
  );

  if (!data.commentCreate.success) {
    fail(`Could not comment on ${issue.identifier}.`);
  }
  console.log(`Commented on ${issue.identifier}: ${data.commentCreate.comment.url}`);
}

async function label(identifier, flags) {
  const toAdd = flags.add ?? [];
  const toRemove = flags.remove ?? [];
  if (toAdd.length === 0 && toRemove.length === 0) {
    fail("Pass at least one --add <label> or --remove <label>.");
  }

  const issue = await fetchIssue(identifier);
  const current = new Map(
    issue.labels.nodes.map((node) => [node.name.toLowerCase(), node.id]),
  );

  for (const name of toAdd) {
    if (current.has(name.toLowerCase())) continue;
    const data = await graphql(
      `query Label($name: String!) {
         issueLabels(first: 1, filter: { name: { eqIgnoreCase: $name } }) {
           nodes { id name }
         }
       }`,
      { name },
    );
    const found = data.issueLabels.nodes[0];
    if (!found) {
      fail(`No such label in Linear: ${name}`);
    }
    current.set(found.name.toLowerCase(), found.id);
  }

  for (const name of toRemove) {
    current.delete(name.toLowerCase());
  }

  await graphql(
    `mutation Relabel($id: String!, $labelIds: [String!]!) {
       issueUpdate(id: $id, input: { labelIds: $labelIds }) { success }
     }`,
    { id: issue.id, labelIds: [...current.values()] },
  );

  console.log(`Labels on ${issue.identifier}: ${[...current.keys()].join(", ") || "(none)"}`);
}

async function state(identifier, stateName) {
  if (!stateName) {
    fail('Pass a state name, e.g. state AND-25 "In Progress".');
  }

  const issue = await fetchIssue(identifier);
  const teamKey = issue.identifier.split("-")[0];
  const data = await graphql(
    `query States($teamKey: String!, $name: String!) {
       workflowStates(first: 1, filter: {
         team: { key: { eq: $teamKey } }
         name: { eqIgnoreCase: $name }
       }) {
         nodes { id name }
       }
     }`,
    { teamKey, name: stateName },
  );

  const target = data.workflowStates.nodes[0];
  if (!target) {
    fail(`No such state on team ${teamKey}: ${stateName}`);
  }

  await graphql(
    `mutation SetState($id: String!, $stateId: String!) {
       issueUpdate(id: $id, input: { stateId: $stateId }) { success }
     }`,
    { id: issue.id, stateId: target.id },
  );

  console.log(`${issue.identifier} is now ${target.name}.`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

// Repeatable flags collect into an array; the rest hold their last value.
const REPEATABLE = new Set(["add", "remove"]);

function parseFlags(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const value = argv[++i];
    if (value === undefined) {
      fail(`Flag --${name} needs a value.`);
    }
    if (REPEATABLE.has(name)) {
      (flags[name] ??= []).push(value);
    } else {
      flags[name] = value;
    }
  }

  return { flags, positional };
}

const USAGE = `Usage:
  node scripts/linear.mjs list [--label <name>] [--project <uuid>]
  node scripts/linear.mjs view <AND-25>
  node scripts/linear.mjs comment <AND-25> (--body <text> | --body-file <path>)
  node scripts/linear.mjs label <AND-25> [--add <name>] [--remove <name>]
  node scripts/linear.mjs state <AND-25> <state name>`;

const [command, ...rest] = process.argv.slice(2);
const { flags, positional } = parseFlags(rest);

switch (command) {
  case "list":
    await list(flags);
    break;
  case "view":
    await view(positional[0]);
    break;
  case "comment":
    await comment(positional[0], flags);
    break;
  case "label":
    await label(positional[0], flags);
    break;
  case "state":
    await state(positional[0], positional.slice(1).join(" "));
    break;
  default:
    fail(USAGE);
}
