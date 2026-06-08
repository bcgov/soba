# VSCode Tools

This repo contains some tools to make VSCode development a little easier.

## Launcher

SOBA can be started using the `Run and Debug` item in the Activity Bar. The `launch.json` file defines the launchers:

- `SOBA Backend`: start the SOBA Backend in debug mode
- `SOBA Frontend`: start the SOBA Frontend in debug mode (uses `pnpm dev:watch`)
- `SOBA (Backend + Temporal + Frontend)`: start all services including frontend
- `SOBA (Backend + Temporal)`: backend stack only — run `soba-fe` in a terminal for frontend with personal memory settings (see `.devcontainer/README.md`)