# slack-big-emoji

A Slack app that posts a workspace custom emoji as a big image, under your own name.

```
/big :party_parrot:
```

The emoji is posted at its original size from your account, not a bot. Animated GIFs stay animated. Aliases resolve to the original emoji.

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

If the log says `OAuth disabled`, one of `SLACK_CLIENT_SECRET`, `STATE_SECRET`, `PUBLIC_URL` is empty and new users can't connect.

## Notes

- **Size follows the original image.** Nothing is scaled up, so a 64px emoji shows at 64px and a 16px emoji stays tiny. Slack stores custom emoji at up to 128px.
- **`data/tokens.json` holds user tokens in plain JSON** (mode `600`, path set by `TOKEN_FILE`). Anyone with this file can post as those users. Keep it out of git and backups you share, don't overwrite it when deploying, and move it with the app when you switch servers, or every user has to reconnect.

## Test

```sh
npm test
```

## License

MIT
