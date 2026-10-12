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

### Studio-wide Edit mode

The catalog and workspaces start read-only. **Edit mode** reserves the whole studio for the displayed user. **Save changes** saves privately; **Exit edit mode** exposes the last saved catalog and releases the lock. Unsaved workspace edits require confirmation before exiting. Closing the workspace or refreshing does not release a lock; return as its owner to resume or exit.

Use **Try the multi-user workflow → View as** to switch between Prakhar, User B and User C. To compare side by side, open two tabs in the same browser and origin, select different users, edit/save in the owner's tab, and verify that the other tab changes only after exit. File downloads and previews remain available in view mode.

This is a browser-only demonstration, not an authorization boundary. Local storage holds an atomic envelope containing the visible catalog, lock and private saved catalog; Web Locks serialize writes between tabs. It requires HTTPS or localhost with Web Locks support. Existing catalog data is copied on the first lock operation without overwriting the legacy storage entry. Separate browsers/devices do not share this state. Production requires authenticated server-owned lock acquisition, ownership validation, persistence and release operations.

### Page-backed Add sub-agent walkthrough

Enter Edit mode, open a group, and choose **Add sub-agent**. Enter one of the sample keys (`p_rsv_vs_distribution`, `p_market_segments`, `p_brand_growth`) or select an example. **Generate from page** creates editable sub-agent and planner packages around a read-only sample contract. Save changed files before continuing to the planner package and activating. These package saves live only within the open import; canceling or leaving before activation discards them.

**Activate sub-agent** stores the new agent and its generated planner package in the lock owner's private studio data. It adds a card but does not call a backend, alter the Coordinator card, or activate runtime behavior. **Exit edit mode** makes the new card visible to simulated other users. Each sample page can be bound once. Unknown keys and invalid packages display validation errors.
