# Agent Studio prototype

A standalone, interactive demonstration of Planner and sub-agent configuration, with Coordinator retained as a frontend-only group card.

## GitHub Pages deployment

This folder is the repository root. The sibling frontend and backend repositories are not included.

Repository: https://github.com/prakhardhama2911/agent-studio-prototype
Expected site: https://prakhardhama2911.github.io/agent-studio-prototype/

One-time setup: open the GitHub repository's Settings > Pages and choose **GitHub Actions** as the Source. Push main, then watch Actions > Deploy Agent Studio to GitHub Pages. If Pages was not enabled before the first run, enable it and rerun the failed workflow.

The workflow installs locked dependencies, runs tests, builds the site, and deploys dist. Asset paths come from GitHub Pages configuration. No manually configured deployment token is needed.

For subsequent source changes, from this folder:

```powershell
git add .
git commit -m "Update Agent Studio"
git push origin main
```

Every push to main triggers deployment. You can also use Actions > Deploy Agent Studio to GitHub Pages > Run workflow.

The hosted app uses bundled data and browser storage. Save changes does not commit to GitHub or change other visitors' data. Shared updates must be made in source and pushed. Existing saved browser drafts can override updated seed data. GitHub Pages does not run the optional local backend proxy. The published JavaScript includes the bundled skill, prompt, and worker-definition contents.

## Agent draft workflow

Planner and every sub-agent share **Draft ? Review ? Publish**. The prototype stores simulated data in this browser; it does not call a backend or database. New sub-agents start with active version 1. Planner retains its existing version history.

1. Open any agent and choose **Create draft** (or **Resume draft**).
2. Edit Skills, Prompts, or Models. Only Planner also has Worker Definitions. File creation, folder/file imports, preview, and ZIP downloads remain available.
3. Autosave or **Save draft** keeps intermediate work. **Exit draft** leaves it available; **Discard draft** deletes only this user's draft for this agent.
4. Open **Review changes**. Closing it records the reviewed revision, highlights Review, and enables publishing. Further edits or a baseline update require a new review.
5. **Publish changes** opens confirmation. Publishing checks the baseline, validates the package, creates an immutable snapshot and activates it in one transaction. Previous snapshots remain in **Publications**.
6. If another user published first, **Update against latest**, resolve conflicts, save, review again, and publish.

The Workflow walkthrough switches simulated users or advances this agent's development version. Reset affects only the selected agent. Group metadata and the display-only Coordinator are outside this package workflow.

### Architecture and future API integration

- `AgentWorkspace` is the shared UI, configured by agent identity and role. `agentWorkflow.ts` contains pure package comparison, validation, and workflow operations. `AgentDraftTour` is optional presentation.
- `AgentWorkflowService` in `src/agentWorkflowService.ts` is the asynchronous boundary: active configuration, drafts, review, publication history, publish, baseline update, and change subscriptions. The factory currently supplies a browser adapter; the workspace also accepts an injected service for testing or API integration.
- Browser records are scoped by catalog/connection and stable agent ID, with drafts keyed by simulated user ID. An agent's full history loads only when opened. Small active-summary projections support catalog counts without loading every history. Models are copied into each package, so edits do not mutate another agent's configuration.
- Browser Web Locks serialize brief read/check/write transactions across tabs, not editing sessions. Revision checks prevent stale saves and baseline checks prevent stale publication. Storage errors preserve the last saved state and open edits. This does not provide production authorization or server durability.
- Migration copies the original bundled Planner history and drafts into the scoped store without deleting the legacy key. Existing sub-agent publication snapshots remain active; differing saved edits become a draft. Without a previous publication, saved configuration becomes the initial active package. Worker registry data is omitted from sub-agent packages.
- Replace the browser adapter with an API implementation when the backend is ready. Enforce identity/authorization, draft revisions, immutable publications, and atomic baseline validation/activation on the server. The UI never needs direct database access. No endpoint paths or DB schema are assumed here.
- Browser history size remains bounded by browser storage capacity, not a production-scale database. A future backend should page history and load snapshot bodies on demand; the prototype service is the replacement point.

### Optional draft guide

Choose **Take a tour** or **Draft guide** in any agent. Guidance follows that agent's available tabs and remembers dismissal per agent/user. Finish, Skip, Close, and Escape restore the starting view/tab and preserve real drafts and unsaved edits. Temporary tour drafts never persist or publish.

Set `AGENT_TOUR_ENABLED` to false in `src/AgentDraftTour.tsx` to hide the guide later. Old Planner module names are compatibility exports only, not separate implementations.

### Verification without starting a server

Run `npm test` and `npm run build`. For the shared workflow browser tests in PowerShell:

```powershell
$env:STUDIO_STATIC_TEST='1'
$env:STUDIO_TEST_URL='https://studio.test/'
npm run test:browser -- tests/browser/agent-workflow.spec.ts tests/browser/planner-workflow.spec.ts tests/browser/planner-tour.spec.ts tests/browser/review-diff.spec.ts
```

The static fixture intercepts the synthetic domain and serves the local production build inside Playwright. It starts no server and makes no backend calls. Deployment remains a separate action.
