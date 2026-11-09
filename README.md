# slack-big-emoji

A Slack app that posts a workspace custom emoji as a big image, under your own name.

```
/big :party_parrot:
```

The emoji is posted at its original size (usually 128px) from your account, not a bot. Animated GIFs stay animated. Aliases resolve to the original emoji.

The first time you use it, you get a **Connect Slack account** button (visible only to you). Approve once in the browser and the emoji is posted right away. After that, it just works.

Limitations: custom emoji only (no Unicode emoji), one emoji per command, and slash commands can't be used inside threads.

## Setup

1. Create an app at https://api.slack.com/apps → **From a manifest**, paste `manifest.yml`, and set `redirect_urls` to your public URL.
2. Create an App-Level Token with `connections:write` → `SLACK_APP_TOKEN`.
3. Install to your workspace → Bot User OAuth Token → `SLACK_BOT_TOKEN`.
4. Copy Client ID / Client Secret → `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`.
5. Fill in `.env` and run (Node 22+):

```sh
cp .env.example .env   # STATE_SECRET: openssl rand -hex 32, PUBLIC_URL: your HTTPS URL
npm install
npm start
```

The app uses Socket Mode, so the only public endpoint is the OAuth callback at `/slack/oauth/callback` (e.g. via Cloudflare Tunnel or Tailscale Funnel on `PORT`, default `3000`).

Scopes: bot `commands`, `emoji:read`; user `chat:write`.

If the log says `OAuth 꺼짐` (OAuth disabled), one of `SLACK_CLIENT_SECRET`, `STATE_SECRET`, `PUBLIC_URL` is empty and new users can't connect.

## Notes

- **Images can't be scaled up.** Slack image blocks have no size option, so the emoji shows at its original resolution.
- **New emoji may take a moment.** The emoji list is cached for 10 minutes. An unknown name triggers a refetch, at most once every 30 seconds.
- **The connect button expires after 10 minutes.** It also stops working if `STATE_SECRET` changes. Approving with a different account than the one that ran the command is rejected.
- **Revoked tokens are handled automatically.** If Slack reports a revoked or under-scoped token (`invalid_auth`, `token_revoked`, `missing_scope`, …), the app deletes it and shows the connect button again.
- **User tokens are stored in plain JSON** at `data/tokens.json` (mode `600`, path set by `TOKEN_FILE`). Treat it like a secret. Keep it out of git, and don't overwrite it when deploying. Move it along with the app when you switch servers, or every user has to reconnect.
- **Keep the redirect URL in sync.** `PUBLIC_URL` must match the Redirect URL in the Slack app settings, or the OAuth step fails with a `redirect_uri` error.
- **Keep the command name in sync.** If you rename `/big` in Slack, set `SLASH_COMMAND` to the same name.
- **Scope changes force a reinstall.** If you change scopes, reinstall the app. Existing users get the connect button again the next time they run the command.

## Test

```sh
npm test
```

## License

MIT
