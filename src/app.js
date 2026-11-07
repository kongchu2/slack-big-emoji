import { App, LogLevel } from '@slack/bolt';
import { createEmojiCache, parseEmojiName } from './emoji.js';
import { createScaler } from './scale.js';
import { createState, readState } from './state.js';
import { createTokenStore } from './tokens.js';

const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`환경 변수가 비어 있습니다: ${missing.join(', ')}`);
  process.exit(1);
}

const env = process.env;
const command = env.SLASH_COMMAND ?? '/big';
const oauthEnabled = Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.STATE_SECRET && env.PUBLIC_URL);
const redirectUri = oauthEnabled ? `${env.PUBLIC_URL.replace(/\/$/, '')}/slack/oauth/callback` : null;
const tokens = await createTokenStore(env.TOKEN_FILE ?? 'data/tokens.json');
const scaler = env.PUBLIC_URL ? createScaler({ dir: env.IMAGE_DIR ?? 'data/img', publicUrl: env.PUBLIC_URL }) : null;
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

function emojiBlocks(emoji) {
  return {
    text: `:${emoji.name}:`,
    blocks: [{ type: 'image', image_url: emoji.url, alt_text: `:${emoji.name}:` }],
  };
}

function page(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
      `<title>큰 이모지</title><body style="font-family:system-ui;padding:40px;line-height:1.6">` +
      `<p>${message}</p></body>`,
  );
}

async function handleCallback(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  if (params.get('error')) return page(res, 400, '연결을 취소했습니다. 슬랙에서 다시 시도해 주세요.');

  const state = readState(env.STATE_SECRET, params.get('state'));
  if (!state) return page(res, 400, '링크가 만료됐습니다. 슬랙에서 명령어를 다시 입력해 주세요.');

  let result;
  try {
    result = await app.client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code: params.get('code'),
      redirect_uri: redirectUri,
    });
  } catch (error) {
    app.logger.error('oauth.v2.access 실패', error);
    return page(res, 500, '연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  const user = result.authed_user;
  if (result.team?.id !== state.team || user?.id !== state.user || !user.access_token) {
    return page(res, 403, '명령어를 입력한 계정과 다른 계정으로 로그인했습니다. 같은 계정으로 다시 시도해 주세요.');
  }

  await tokens.set(state.team, state.user, user.access_token);

  if (state.responseUrl) {
    fetch(state.responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_original: true }),
    }).catch((error) => app.logger.warn('안내 메시지 지우기 실패', error));
  }

  try {
    await app.client.chat.postMessage({
      token: user.access_token,
      channel: state.channel,
      ...emojiBlocks({ name: state.name, url: state.url }),
    });
    return page(res, 200, `연결했고 :${state.name}: 을 올렸습니다. 이 창은 닫아도 됩니다.`);
  } catch (error) {
    app.logger.warn('연결 직후 올리기 실패', error.data?.error ?? error);
    return page(res, 200, `연결했습니다. 슬랙으로 돌아가 <code>${command}</code> 를 다시 입력해 주세요.`);
  }
}

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  appToken: env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: env.LOG_LEVEL ?? LogLevel.INFO,
  installerOptions: { port: Number(env.PORT ?? 3000) },
  customRoutes: [
    ...(oauthEnabled ? [{ path: '/slack/oauth/callback', method: ['GET'], handler: handleCallback }] : []),
    ...(scaler ? [{ path: '/img/:file', method: ['GET'], handler: (req, res) => scaler.serve(req, res) }] : []),
  ],
});

const lookupEmoji = createEmojiCache(app.client);

const megaCommand = env.MEGA_COMMAND ?? '/mega';

app.command(command, ({ command: cmd, ack, respond }) => handleCommand(cmd, ack, respond, 1));
app.command(megaCommand, ({ command: cmd, ack, respond }) => handleCommand(cmd, ack, respond, 2));

async function handleCommand(cmd, ack, respond, scale) {
  await ack();

  const name = parseEmojiName(cmd.text ?? '');
  if (!name) {
    return respond({
      response_type: 'ephemeral',
      text: `사용법: \`${command} :이모지이름:\`, 두 배로 크게: \`${megaCommand} :이모지이름:\``,
    });
  }

  const found = await lookupEmoji(name);
  if (!found) {
    return respond({
      response_type: 'ephemeral',
      text: `:${name}: 을 찾지 못했습니다. 워크스페이스에 추가된 커스텀 이모지만 쓸 수 있습니다.`,
    });
  }

  let emoji = found;
  if (scale > 1) {
    if (!scaler) {
      return respond({ response_type: 'ephemeral', text: '크게 키우기는 아직 꺼져 있습니다. 앱 관리자에게 문의해 주세요.' });
    }
    try {
      emoji = { name: found.name, url: await scaler.scaledUrl(found, scale) };
    } catch (error) {
      app.logger.error('이모지 키우기 실패', error);
      return respond({ response_type: 'ephemeral', text: `:${found.name}: 을 키우지 못했습니다.` });
    }
  }

  const askToConnect = (lead) => {
    if (!oauthEnabled) {
      return respond({ response_type: 'ephemeral', text: `${lead} 아직 연결 기능이 꺼져 있습니다. 앱 관리자에게 문의해 주세요.` });
    }
    const state = createState(env.STATE_SECRET, {
      team: cmd.team_id,
      user: cmd.user_id,
      channel: cmd.channel_id,
      name: emoji.name,
      url: emoji.url,
      responseUrl: cmd.response_url,
    });
    const text = `${lead} 연결하면 :${emoji.name}: 이 바로 올라갑니다.`;
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
              text: { type: 'plain_text', text: 'Slack 계정 연결' },
              url: authorizeUrl(state),
            },
          ],
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: '버튼은 10분 동안 쓸 수 있습니다.' }] },
      ],
    });
  };

  const userToken = tokens.get(cmd.team_id, cmd.user_id);
  if (!userToken) return askToConnect('본인 이름으로 올리려면 한 번 연결해야 합니다.');

  try {
    await app.client.chat.postMessage({ token: userToken, channel: cmd.channel_id, ...emojiBlocks(emoji) });
  } catch (error) {
    const code = error.data?.error;
    if (REVOKED.has(code)) {
      await tokens.remove(cmd.team_id, cmd.user_id);
      return askToConnect('연결이 끊겼습니다.');
    }
    app.logger.error('chat.postMessage 실패', code ?? error);
    return respond({ response_type: 'ephemeral', text: `올리지 못했습니다 (${code ?? '알 수 없는 오류'}).` });
  }
}

app.action(CONNECT_ACTION, async ({ ack }) => {
  await ack();
});

await app.start();
app.logger.info(`${command} 준비됨. ${oauthEnabled ? `OAuth 콜백: ${redirectUri}` : 'OAuth 꺼짐 (SLACK_CLIENT_SECRET, STATE_SECRET, PUBLIC_URL 필요)'}`);
