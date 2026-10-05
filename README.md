# Agent Studio prototype

A standalone, interactive demonstration of Planner and sub-agent configuration, with Coordinator retained as a frontend-only group card. This folder is independent of `cp-alchemy-agent-v2`, `cp-alchemy-frontend-v2`, and the earlier `agent-studio-prototype-v0`.

## Start the demo

Requires Node.js 22.12+ (Node 24 is supported).

```powershell
cd C:\Users\82437\Documents\alchemy-agent-project\agent-studio-prototype
npm install
npm run dev
```

Open **http://127.0.0.1:5174/**. Dependencies are already installed in this workspace. You can also double-click `Start Demo.cmd` after stopping an already running instance.

The demo opens with sample data. It needs no backend, API key, model calls, or external font service. Use the reset icon to return the current catalog to its loaded source before a presentation.

## Suggested five-minute walkthrough

1. **Catalog:** Explain the Coordinator, Planner, and three existing analysis groups. Their roles are visually distinct while retaining the existing card layout.
2. **Agent overview:** Coordinator remains a display-only card. In the Planner and sub-agent workspaces, use the full-width Primary instructions section for complete skill content. Supporting resources remain accessible through the configuration tabs.
3. **Planner → Prompts:** Inspect the actual static planner prompt captured from the repository. Explain that the runtime additionally composes limits, policy, and context.
4. **Planner → Worker Definitions:** Explore the backend worker-registry folder in a read-only IDE-style viewer. Open the complete PQA, Ad-hoc, Market Segments, and TEMPLATE.md files; use file tabs, line numbers, syntax highlighting, word wrap, and copy.
5. **Planner → Models:** Show language-model and embedding profiles. Explore provider, deployment, client, retry, timeout, and generation/embedding settings.
6. **PQA Analysis → Skills:** Add `references/demo-notes.md`, edit it, preview it, and click **Save locally**. Refresh and reopen to show persistence.
7. **PQA Analysis → Prompts:** Preview the prompt using sample question/scope values. This substitutes text without calling a model.
8. **PQA Analysis / Models:** Edit the deployment directly. Changes are scoped to the selected agent; other agents retain their existing settings.
9. **Export:** Download the configuration as JSON. Import restores the configuration for this browser. Create a group/sub-agent to demonstrate expansion.

All unsaved edits are protected when closing a workspace; **Discard changes** restores the most recent local save. **Save locally** persists to localStorage, scoped separately for sample data and each backend/identity. Exports also include currently unsaved workspace edits. Imported configuration replaces only the selected local catalog, after confirmation.

## Optional read-only backend connection

Copy `.env.example` to `.env.local` in **this folder** and set:

```dotenv
AGENT_BACKEND_URL=http://127.0.0.1:8000
```

Restart `npm run dev`, click **Connect live skills**, and supply an authorized JWT access token if required. The token remains in memory, is not saved to browser storage, and is not included in exports. It must be entered again after refreshing. The backend performs authorization; this prototype does not bypass it.

The Vite development proxy allows only GET requests for:

- `/api/bootstrap`
- `/api/agents/{agentId}`
- `/api/agent-studio/skill-packages/{agentId}/{skillId}`

Everything else is rejected before proxying. Existing skills load on opening their agent. Package editing, group creation, and new configuration saves are local only. Reconnecting restores that identity’s saved draft without silently overwriting it with refreshed server content. A failed connection offers explicit recovery to sample data.

The target should be an ordinary service URL; do not put credentials in it. No backend configuration files need modification. `npm run preview` serves the built sample demo only; use the development server for the optional backend proxy.

## What is real and what is illustrative

- Planner prompt and six planner skills: repository snapshot from `app/agents/planner/graph.py` and `app/agents/planner/templates/`.
- Three worker definitions: repository snapshots of the `worker-registry/worker--*.md` files. Full original definitions are retained in the snapshot and sample worker skill packages. The Details form is a readable projection; its generated JSON preview is a prototype view, not the backend registry schema.
- Worker prompt templates and sample skills: explicitly illustrative; live mode reads existing database skill packages. Coordinator has no active configuration; older local drafts/imports are normalized to keep its card only.
- Model profiles: illustrative shared profiles. Provider-specific deployment identities and model versions are not supplied by the existing Studio endpoints, so unavailable identities show **Not provided**. Settings demonstrate the intended authoring controls and do not claim to describe active deployments.
- UI groups organize workers. They are not executable agents and do not acquire fake runtime configuration.
- Header navigation outside Agent Studio opens the demo guide. This is a focused prototype, not a copy of the whole application.

## Development handoff

- `src/types.ts`: domain contracts for agents, prompts, workers, model profiles, and catalog groups.
- `src/data.ts` and `src/repository-snapshot.json`: demo fixtures and traceable, non-secret repository content.
- `src/lib/api.ts`: read-only backend adapter.
- `src/lib/core.mjs`: versioned export/import, local persistence, identity scope, file validation, and endpoint allowlist.
- `src/main.tsx`: catalog, connection, group management, and local data ownership.
- `src/workspace.tsx`: tabbed agent workspace and editors.
- `src/WorkerRegistryViewer.tsx` and `src/worker-registry-files.json`: read-only Planner registry explorer and exact file snapshots copied from the backend worker-registry directory. These are bundled snapshots, not a live filesystem connection.
- `src/ui.tsx` and `src/styles.css`: shared dialog/button primitives and responsive visual styling.

All code and dependencies are contained here. There are no runtime imports from either existing repository. UI components are custom to the prototype; protected components in the frontend repo were not changed.

Future integration should replace fixture/local adapters with authenticated configuration services and supply authoritative prompt composition, worker-definition schemas, model capability metadata, and model assignments. Preserve the distinction between draft edits, publication, and runtime activation. No new backend endpoints, database migrations, publishing, or model execution are implemented here.

## Checks and screenshots

```powershell
npm test
npm run build
# With npm run dev running in another terminal and Chrome installed:
npm run test:browser
```

Browser checks cover agent navigation, repository content, skill persistence, file imports, invalid JSON, prompt preview, model override isolation, live-read fixtures, blocked write requests, connection recovery, local creation, and mobile layout. They use isolated browser contexts, not your demo’s saved draft.

Screenshots are saved in `artifacts/`. Live backend behavior is tested with representative HTTP fixtures; a real authenticated database connection requires your running backend and access token.

Browser storage is per browser/origin and is not a team database. Use Export before clearing site data or sharing a draft. Unsupported or oversized imported files produce errors; supported text files are `.md`, `.json`, `.yaml`, `.yml`, `.txt`, and `.csv` up to 2 MB each. Empty folders are a transient file-creation step; only folders containing saved files survive reload/export.

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
