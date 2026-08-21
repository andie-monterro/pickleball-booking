# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Check the ticket**: the branch is named `sandcastle/<TICKET-ID>`. Read the ticket with
   `node scripts/linear.mjs view <TICKET-ID>` and check that every acceptance criterion on it has a
   direct test. A missing test for a stated criterion is a finding.

6. **Apply project standards**: Follow the coding standards defined in @.sandcastle/CODING_STANDARDS.md

7. **Preserve functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch.
2. Run `npm run typecheck` and `npm test` to make sure nothing is broken. `TEST_PG_ADMIN_URL` is
   already set, so `npm test` needs no setup.
3. Commit the refinements. The message needs a conventional prefix and ends with the ticket id in
   parentheses, e.g. `refactor: fold duplicate slot lookup (AND-25)`.

Do not push the branch and do not open a pull request — a later phase does that.

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
