import { App, LogLevel } from '@slack/bolt';
import { createEmojiCache, parseEmojiNames, parseSkinTone } from './emoji.js';
import { createState, readState } from './state.js';
import { createTokenStore } from './tokens.js';

const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const env = process.env;
// Optional variables fall back to their default when unset or left empty.
const optional = (name, fallback) => env[name]?.trim() || fallback;

const command = optional('SLASH_COMMAND', '/big');
const port = Number(optional('PORT', '3000'));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${env.PORT}`);
  process.exit(1);
}
const requestedLogLevel = optional('LOG_LEVEL', LogLevel.INFO).toLowerCase();
const logLevel = Object.values(LogLevel).includes(requestedLogLevel) ? requestedLogLevel : LogLevel.INFO;
if (logLevel !== requestedLogLevel) {
  console.warn(`Unknown LOG_LEVEL "${env.LOG_LEVEL}", using "${logLevel}". Allowed: ${Object.values(LogLevel).join(', ')}`);
}
const oauthEnabled = Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.STATE_SECRET && env.PUBLIC_URL);
const redirectUri = oauthEnabled ? `${env.PUBLIC_URL.replace(/\/$/, '')}/slack/oauth/callback` : null;
const tokens = await createTokenStore(optional('TOKEN_FILE', 'data/tokens.json'), {
  onSaveError: (error) => app.logger.error('Failed to save the token file, will retry', error),
});
const CONNECT_ACTION = 'connect';

const REVOKED = new Set(['invalid_auth', 'token_revoked', 'account_inactive', 'not_authed', 'missing_scope']);

function authorizeUrl(state) {
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  url.searchParams.set('user_scope', 'chat:write');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

const label = (emoji) => `:${emoji.name}:`;

function deliver(token, channel, emoji) {
  return app.client.chat.postMessage({
    token,
    channel,
    text: label(emoji),
    blocks: [{ type: 'image', image_url: emoji.url, alt_text: label(emoji) }],
  });
}

function page(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
      `<title>Big Emoji</title><body style="font-family:system-ui;padding:40px;line-height:1.6">` +
      `<p>${message}</p></body>`,
  );
}

async function handleCallback(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  if (params.get('error')) return page(res, 400, 'Connection cancelled. Please try again in Slack.');

  const state = readState(env.STATE_SECRET, params.get('state'));
  if (!state) return page(res, 400, 'This link has expired. Please run the command again in Slack.');

  let result;
  try {
    result = await app.client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code: params.get('code'),
      redirect_uri: redirectUri,
    });
  } catch (error) {
    app.logger.error('oauth.v2.access failed', error);
    return page(res, 500, 'Could not connect. Please try again later.');
  }

  const user = result.authed_user;
  if (result.team?.id !== state.team || user?.id !== state.user || !user.access_token) {
    return page(res, 403, 'You signed in with a different account than the one that ran the command. Please try again with the same account.');
  }

  await tokens.set(state.team, state.user, user.access_token);

  if (state.responseUrl) {
    fetch(state.responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_original: true }),
    }).catch((error) => app.logger.warn('Failed to delete the connect message', error));
  }

  try {
    await deliver(user.access_token, state.channel, state.emoji);
    return page(res, 200, `Connected and posted ${label(state.emoji)}. You can close this window.`);
  } catch (error) {
    app.logger.warn('Post right after connecting failed', error.data?.error ?? error);
    return page(res, 200, `Connected. Please go back to Slack and run the command again.`);
  }
}

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  appToken: env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel,
  installerOptions: { port },
  customRoutes: [
    ...(oauthEnabled ? [{ path: '/slack/oauth/callback', method: ['GET'], handler: handleCallback }] : []),
  ],
});

const lookupEmoji = createEmojiCache(app.client);

app.command(command, async ({ command: cmd, ack, respond }) => {
  await ack();

  const names = parseEmojiNames(cmd.text ?? '');
  if (!names) {
    return respond({ response_type: 'ephemeral', text: `Usage: \`${command} :emoji_name:\`` });
  }
  if (names.length > 1) {
    return respond({ response_type: 'ephemeral', text: `\`${command}\` takes only one emoji.` });
  }

  const userToken = tokens.get(cmd.team_id, cmd.user_id);
  if (!userToken && !oauthEnabled) {
    return respond({
      response_type: 'ephemeral',
      text: 'To post under your name, you need to connect your account once, but connecting is turned off. Please contact the app admin.',
    });
  }

  let emoji;
  try {
    emoji = await lookupEmoji(names[0], parseSkinTone(cmd.text));
  } catch (error) {
    app.logger.error('emoji.list failed', error.data?.error ?? error);
    return respond({ response_type: 'ephemeral', text: 'Could not load the emoji list. Please try again later.' });
  }
  if (!emoji) {
    return respond({
      response_type: 'ephemeral',
      // In a code span, so Slack does not render the name as an emoji or as markdown.
      text: `Could not find \`:${names[0]}:\`.`,
    });
  }

  const askToConnect = (lead) => {
    if (!oauthEnabled) {
      return respond({ response_type: 'ephemeral', text: `${lead} Connecting is turned off. Please contact the app admin.` });
    }
    const state = createState(env.STATE_SECRET, {
      team: cmd.team_id,
      user: cmd.user_id,
      channel: cmd.channel_id,
      emoji,
      responseUrl: cmd.response_url,
    });
    const text = `${lead} Once connected, ${label(emoji)} will be posted right away.`;
    return respond({
      response_type: 'ephemeral',
      text,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text } },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              action_id: CONNECT_ACTION,
              style: 'primary',
              text: { type: 'plain_text', text: 'Connect Slack account' },
              url: authorizeUrl(state),
            },
          ],
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'This button works for 10 minutes.' }] },
      ],
    });
  };

  if (!userToken) return askToConnect('To post under your name, connect your Slack account once.');

  try {
    await deliver(userToken, cmd.channel_id, emoji);
  } catch (error) {
    const code = error.data?.error;
    if (REVOKED.has(code)) {
      await tokens.remove(cmd.team_id, cmd.user_id);
      return askToConnect('Your connection has expired.');
    }
    app.logger.error('Post failed', code ?? error, error.data?.response_metadata?.messages ?? '');
    return respond({ response_type: 'ephemeral', text: `Could not post (${code ?? 'unknown error'}).` });
  }
});

app.action(CONNECT_ACTION, async ({ ack }) => {
  await ack();
});

await app.start();
app.logger.info(`${command} ready. ${oauthEnabled ? `OAuth callback: ${redirectUri}` : 'OAuth disabled (needs SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, STATE_SECRET, PUBLIC_URL)'}`);
