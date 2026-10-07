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

## Planner draft workflow walkthrough

Planner uses a business-user flow: **Draft ? Review ? Publish**. This workflow uses browser-stored dummy data only; it does not access a database, backend, or Git release process.

1. Open Planner and select **Create draft** to copy active development and record its baseline.
2. Edit skills, prompts, worker definitions, or models. Autosave and **Save draft** keep intermediate work. **Exit draft** and **Resume draft** let you continue later.
3. Optionally use **Review changes** to compare the draft with its baseline.
4. Select **Publish changes** and confirm. The baseline is rechecked against current development; a valid package creates an immutable snapshot and becomes active together. The source draft closes. History remains in **Publications**.
5. If development has advanced, publishing is blocked and the draft is preserved. **Update against latest**, resolve any conflicts, save the updated draft, then publish.

Under **Workflow walkthrough**, switch between Prakhar and Maya to demonstrate separate drafts or select **Simulate development update** to model another user's publication. **Discard draft** removes only that user's draft; **Reset walkthrough** clears the demonstration after confirmation.

No Git promotion is required in this flow. Old unactivated snapshots from the earlier workflow remain archived; creating a draft from them allows review and baseline update without silently activating historical work. Real deployment will require the backend to implement atomic baseline validation, immutable publication, and activation. The prototype simulates those operations with one browser-storage update.

### Optional draft guide

Open Planner and choose **Take a tour**, or use **Draft guide** to replay it. The eight-step guide highlights controls, supports Back/Next/Skip/Escape, remembers dismissal, and uses an in-memory draft copy after an explicit action. Finish, Skip, Close, and Escape restore the starting view and tab, keeping real drafts and unsaved edits intact. Tour drafts are never persisted; refreshing during a tour cannot leave an extra draft. It never publishes automatically.

To hide onboarding later, set `PLANNER_TOUR_ENABLED` to `false` in `src/PlannerTour.tsx`. The guide, invitation, and replay button are separate from the draft workflow; its preference uses its own browser-storage key.
