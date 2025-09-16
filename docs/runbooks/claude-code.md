# Claude Code CLI & MCP Servers

All fleet-managed devices now ship with the Claude Code CLI plus two Model Context Protocol servers (Slack and Playwright).
The GitOps agent provisions and maintains everything automatically so operators can immediately connect Claude Code to
fleet infrastructure.

## What the agent installs

`agent/setup-claude-tools.sh` runs during every convergence cycle (before Docker Compose is applied):

- Installs/updates Node.js (via APT) if the host is missing Node >= 18.
- Installs the latest `@anthropic-ai/claude-code` CLI, `@modelcontextprotocol/server-slack`, and `@automatalabs/mcp-server-playwright` globally.
- Bootstraps Playwright system dependencies and downloads Chromium into `/var/lib/claude-code/playwright/browsers`.
- Manages `/etc/claude-code/managed-mcp.json`, registering both MCP servers at the enterprise scope.
- Drops `/etc/profile.d/claude-code.sh`, which loads secrets from `/etc/claude-code/secrets.env` into every interactive shell.

The package updater runs at most once every 24 hours (tracked in `/var/lib/claude-code/last-update`). If a package is
missing, it is installed immediately regardless of the interval.

## Slack MCP server

The managed configuration defines a `slack` MCP server that executes the globally installed `mcp-server-slack` binary:

```json
{
  "mcpServers": {
    "slack": {
      "type": "stdio",
      "command": "mcp-server-slack",
      "env": {
        "SLACK_BOT_TOKEN": "${CLAUDE_SLACK_BOT_TOKEN:-}",
        "SLACK_TEAM_ID": "${CLAUDE_SLACK_TEAM_ID:-}",
        "SLACK_CHANNEL_IDS": "${CLAUDE_SLACK_CHANNEL_IDS:-}"
      }
    }
  }
}
```

Populate the following secrets to make the Slack integration functional:

- `CLAUDE_SLACK_BOT_TOKEN` – bot token beginning with `xoxb-`.
- `CLAUDE_SLACK_TEAM_ID` – workspace/team ID (starts with `T`).
- `CLAUDE_SLACK_CHANNEL_IDS` – optional comma-separated allowlist.

## Playwright MCP server

The managed configuration exposes Playwright via `mcp-server-playwright`. The agent preloads browser assets so that
first use is immediate:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "mcp-server-playwright",
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "/var/lib/claude-code/playwright/browsers"
      }
    }
  }
}
```

The `PLAYWRIGHT_BROWSERS_PATH` is writable by root and world-readable so non-root users running Claude Code can access the
cached Chromium binaries. If you ever need to refresh Playwright’s browsers, delete the marker files in
`/var/lib/claude-code/` (`playwright-deps-installed` / `playwright-browsers-installed`) and let the agent rerun.

## Managing secrets

Secrets are loaded from `/etc/claude-code/secrets.env`. The file is not created automatically; provision it with SOPS or
any secure mechanism you already use. Example template:

```env
CLAUDE_SLACK_BOT_TOKEN=xoxb-...
CLAUDE_SLACK_TEAM_ID=T01234567
CLAUDE_SLACK_CHANNEL_IDS=C01234567,C08976543
# Optional additional environment variables for Claude Code
CLAUDE_API_KEY=sk-ant-...
```

Because `/etc/profile.d/claude-code.sh` is managed by the agent, any shell session (including SSH) will automatically
export the variables defined above before you launch `claude`. Restart existing shells after editing the secrets file.

## Verification

1. `claude --version` – confirm the CLI is on the expected version.
2. `claude mcp list` – should list `slack` and `playwright` under the Enterprise scope.
3. Trigger a manual run: `sudo /opt/fleet/agent/role-agent.sh` and check logs for the `[setup-claude-tools]` messages.
4. Review `/etc/claude-code/managed-mcp.json` to confirm configuration drift is corrected during convergence.

For additional CLI usage, refer to the upstream [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/overview).
