# slack-big-emoji

Post a Slack emoji as a big image, as yourself.

```
/big :party_parrot:
```

![The same emoji posted with /big (top) and as a normal Slack message (bottom)](docs/demo.gif)

*Top: posted with `/big`. Bottom: the same emoji in a normal message.*

Slack shows emoji small, even when a message is nothing but the emoji. `/big` posts the emoji's original image instead, so it shows at full size (up to 128px for custom emoji, 160px for built-in ones). The message comes from your own account, not a bot, and animated emoji stay animated.

This is a self-hosted app. There is no public install link: you create your own Slack app and run this small Node server for your workspace.

## Usage

```
/big :party_parrot:
/big party_parrot
/big :thumbsup::skin-tone-3:
```

- Both forms work. Names are case-insensitive, and aliases resolve to the original emoji.
- Built-in emoji such as `:smile:` work too, with skin tones. They are posted as Apple's 160px image.
- The first time, you get a **Connect Slack account** button that only you can see. Approve once in the browser and the emoji is posted right away. After that, `/big` just works.
- Errors (unknown emoji, more than one emoji) are shown only to you.

Limitations:

- One emoji per command.
- Slack does not allow slash commands inside threads.
- Nothing is scaled up. A 64px emoji shows at 64px.
- Built-in emoji images are loaded from jsDelivr (the [emoji-data](https://github.com/iamcal/emoji-data) repository), not from Slack. If that CDN is down, only built-in emoji fail.

## How it works

1. Slack delivers `/big` to the app over Socket Mode.
2. The app finds the emoji's image URL with `emoji.list`, using the bot token. The list is cached for 10 minutes. A name that is not in the cache triggers an early refresh, at most once every 30 seconds, so new emoji work almost right away. A name that is not a custom emoji is looked up in the bundled `emoji-datasource` list of built-in emoji, which gives an image URL on jsDelivr.
3. The app posts a message with an image block that points at that URL, using your user token. No image is downloaded or re-uploaded.

If you have no user token yet, step 3 is replaced by the connect button. It opens Slack's OAuth page, and the callback saves your token and posts the emoji you asked for. The button is signed with `STATE_SECRET`, works for 10 minutes, and is rejected if you approve with a different account. If you later revoke the app, the next `/big` shows the button again.

## Permissions

| Token | Scope | Used for |
| --- | --- | --- |
| Bot | `commands` | Receiving the slash command |
| Bot | `emoji:read` | Listing the workspace's custom emoji |
| User | `chat:write` | Posting the emoji as you |

The app uses your user token only to post the emoji you asked for. It requests no scope that reads messages.

## Setup

You need Node 22+ and a public HTTPS URL that forwards to the app's port, for example through Cloudflare Tunnel or Tailscale Funnel. The app uses Socket Mode, so the only public endpoint is the OAuth callback at `/slack/oauth/callback`.

1. Create an app at https://api.slack.com/apps → **From a manifest**, paste `manifest.yml`, and set `redirect_urls` to `https://<your host>/slack/oauth/callback`.
2. **Basic Information → App-Level Tokens**: create a token with `connections:write` → `SLACK_APP_TOKEN`.
3. Install the app to your workspace. **OAuth & Permissions → Bot User OAuth Token** → `SLACK_BOT_TOKEN`.
4. **Basic Information → App Credentials**: Client ID and Client Secret → `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`.
5. Fill in `.env` and run:

```sh
cp .env.example .env
npm install
npm start
```

The app is ready when the log says `/big ready. OAuth callback: https://…`. If it says `OAuth disabled`, one of `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `STATE_SECRET`, `PUBLIC_URL` is empty and new users can't connect.

One deployment serves one workspace.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | Yes | Bot token (`xoxb-…`) |
| `SLACK_APP_TOKEN` | Yes | App-level token for Socket Mode (`xapp-…`) |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | For connecting | OAuth credentials of the Slack app |
| `STATE_SECRET` | For connecting | Secret that signs the connect button. Generate with `openssl rand -hex 32`. |
| `PUBLIC_URL` | For connecting | HTTPS origin where the callback is reachable, e.g. `https://big-emoji.example.com` |
| `PORT` | No | Port of the callback server. Default `3000`. |
| `SLASH_COMMAND` | No | Command name. Default `/big`. Must match the Slack app's command. |
| `TOKEN_FILE` | No | Where user tokens are stored, relative to the directory the app is started from. Default `data/tokens.json`. |
| `LOG_LEVEL` | No | Bolt log level: `debug`, `info`, `warn` or `error`. Default `info`. |

Optional variables fall back to their default when left empty.

## Token file

The token file (`data/tokens.json`, or the path set by `TOKEN_FILE`) holds user tokens in plain JSON (mode `600`). Anyone with this file can post as those users.

- Keep it out of git and out of backups you share. `.gitignore` only covers `data/`, so if you change the path, add your own entries for the file and the `.tmp` file written next to it.
- Don't overwrite it when deploying.
- Move it with the app when you switch servers, or every user has to reconnect.

## Test

```sh
npm test
```

## License

MIT
