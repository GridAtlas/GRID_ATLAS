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
