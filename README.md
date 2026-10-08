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
