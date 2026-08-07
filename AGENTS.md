# Automated Agent Startup

Before meaningful work, the agent should run:

```powershell
pwsh -File C:\Users\jimas\Documents\GRID_ATLAS_SHARED\scripts\preflight.ps1 -ProjectRoot (Get-Location) -Agent Codex -Topic "短い作業名"
```

Then read the shared contract files listed by the script. At the end of work, create a handoff file:

```powershell
pwsh -File C:\Users\jimas\Documents\GRID_ATLAS_SHARED\scripts\new-handoff.ps1 -Agent Codex -Project Web -Topic "短い作業名"
```

The shared contract is authoritative for product philosophy and common semantics. Do not silently turn a proposal into an accepted decision.
## Web versioning

For every user-visible Web update, automatically classify the change and bump the displayed Web version before committing:

- `+0.0001`: bug fixes, small visual changes, or wording changes
- `+0.0010`: small-to-medium feature additions or interaction changes
- `+0.0100`: large feature groups or development milestones
- `+0.1000`: only after an explicit user decision; never auto-bumped

Use four decimal places for Web versions. Keep `src/main.js` (`WEB_VERSION`) and the version line in `README.md` synchronized. Use `npm run version:web -- --kind patch|feature|milestone` to apply the bump, and include the resulting version in the handoff. Do not wait for the user to request a version bump.