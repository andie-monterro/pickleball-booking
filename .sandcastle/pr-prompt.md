# TASK

Open a pull request for the work on branch `{{BRANCH}}` — ticket {{TASK_ID}}: {{ISSUE_TITLE}}

**Merge nothing.** A human reviews every pull request before anything reaches `main`. Never run `gh pr merge`, and never push to `main`.

# CONTEXT

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --format="%h %s"`

## Files changed

!`git diff --stat {{TARGET_BRANCH}}...{{BRANCH}}`

# STEPS

1. Run `gh auth setup-git`, so `git push` can use the `GH_TOKEN` in your environment.
2. Merge the latest `{{TARGET_BRANCH}}` into this branch. Resolve any conflict by reading both sides and choosing the correct result — never by taking one side blindly.
3. Run `npm run typecheck` and `npm test`. `TEST_PG_ADMIN_URL` is already set, so `npm test` needs no setup.
   - Both pass: continue.
   - You cannot make them pass: do **not** open a pull request. Comment the failure on the ticket (step 6 has the command), then output the completion signal and stop.
4. Push the branch: `git push -u origin {{BRANCH}}`.
5. Open the pull request:

   ```
   gh pr create --base {{TARGET_BRANCH}} --head {{BRANCH}} \
     --title "{{TASK_ID}}: <short summary>" --body "<body>"
   ```

   The body needs three things: what changed, how it was tested, and a plain link to the Linear ticket.
   Write the ticket as a plain link. Never write `Closes`, `Fixes`, or `Resolves` — nothing may auto-close.

6. Report back on the ticket:

   ```
   node scripts/linear.mjs comment {{TASK_ID}} --body "PR opened: <url>. Not merged — waiting for human review."
   ```

   If a human must do something you cannot (add a secret, provision a service, click a dashboard), list it as a checklist in that comment and swap the label:

   ```
   node scripts/linear.mjs label {{TASK_ID}} --add ready-for-human --remove ready-for-agent
   ```

Do not change the ticket state. A human moves tickets to Done after acceptance testing.

# WHEN YOU FINISH

Print one line: the pull request URL, or why there is none.

Then output <promise>COMPLETE</promise>.
