# Automated Agent Startup

Before meaningful work, read the shared product contract at:

`C:\Users\jimas\Documents\GRID_ATLAS_SHARED`

Run the preflight script before editing:

```powershell
pwsh -File C:\Users\jimas\Documents\GRID_ATLAS_SHARED\scripts\preflight.ps1 -ProjectRoot (Get-Location) -Agent Claude -Topic "短い作業名"
```

At the end, create a handoff file with `new-handoff.ps1`. Common product meaning is decided in the shared `DECISIONS.md`; Web and Native implementation details may differ.
