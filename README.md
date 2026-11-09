# slack-big-emoji

워크스페이스의 커스텀 이모지를 **큰 이미지로, 내 이름으로** 채널에 올리는 Slack 앱입니다.

Slack에서 이모지만 단독으로 보내도 작은 크기로만 보입니다. 이 앱은 이모지의 원본 이미지를 메시지로 올려서, 이모지를 원래 크기(보통 128px)로 크게 보여 줍니다. 봇이 아니라 **명령어를 입력한 사람의 계정으로** 올라가서, 내가 직접 보낸 메시지처럼 보입니다. 움직이는 GIF 이모지도 움직이는 채로 올라갑니다.

## 사용법

```
/big :party_parrot:
```

이모지 하나를 이미지 블록으로 크게 올립니다. 한 번에 하나만 받습니다.

- 이름은 `:party_parrot:` 이나 `party_parrot` 어느 형태로 적어도 됩니다. 대소문자는 가리지 않고, 피부색 수식자(`::skin-tone-2:`)는 무시합니다.
- 별칭(alias) 이모지는 원본 이모지를 찾아 올립니다.
- 찾지 못한 이모지는 나에게만 보이는 메시지로 알려 줍니다.
- 명령어만 입력하면 사용법을 알려 줍니다.

### 처음 쓸 때: 계정 연결

내 이름으로 올리려면 앱이 내 Slack 계정 권한을 한 번 받아야 합니다.

1. 처음 명령어를 입력하면 나에게만 보이는 **「Slack 계정 연결」** 버튼이 나옵니다.
2. 버튼을 누르고 브라우저에서 허용하면, 입력했던 이모지가 바로 올라가고 버튼 메시지는 지워집니다.
3. 그 뒤로는 연결 없이 바로 올라갑니다.

버튼은 10분 동안만 쓸 수 있습니다. 명령어를 입력한 계정과 다른 계정으로 허용하면 거절합니다. 연결을 해제했거나 권한이 바뀌었으면 다음 명령어 때 연결 버튼이 다시 나옵니다.

### 안 되는 것

- 커스텀 이모지만 됩니다. 기본 유니코드 이모지(😀 등)는 안 됩니다.
- 슬래시 커맨드는 Slack 제한 때문에 스레드 안에서 쓸 수 없습니다.
- Slack 이미지 블록에는 크기 지정 기능이 없어서, 이모지 원본보다 크게 키울 수는 없습니다.

## 동작 방식

```
사용자 ──/big :x:──▶ Slack ──Socket Mode──▶ 앱 (서버)
                                            │ 1. emoji.list 로 :x: 이미지 URL 찾기 (봇 토큰, 10분 캐시)
                                            │ 2. 이 사용자의 토큰이 있나?
                                            │    ├─ 없음 → 연결 버튼 (OAuth) → 콜백에서 토큰 저장 후 바로 올림
                                            │    └─ 있음 → 3으로
                                            ▼ 3. 사용자 토큰으로 올리기
                              chat.postMessage (이미지 블록, Slack CDN 의 이모지 URL)
```

- **Socket Mode**를 써서 앱이 Slack에 먼저 연결합니다. Slack 이벤트를 받으려고 서버 포트를 열 필요가 없습니다.
- 다만 OAuth 허용 뒤 브라우저가 돌아올 **콜백 주소**(`/slack/oauth/callback`)는 공개 HTTPS로 열려 있어야 합니다. Cloudflare Tunnel이나 Tailscale Funnel로 `PORT`를 열면 됩니다. 외부에 열리는 경로는 이것 하나뿐입니다.
- 연결 버튼의 `state`에는 팀, 사용자, 채널, 이모지가 담기고 `STATE_SECRET`으로 서명됩니다(HMAC-SHA256, 10분 만료). 그래서 서버에 별도 세션 저장소가 없습니다.
- 사용자 토큰은 `data/tokens.json`에 `팀ID:사용자ID` 키로 저장합니다(파일 권한 600). Slack이 토큰 취소나 권한 부족(`invalid_auth`, `token_revoked`, `missing_scope` 등)을 알려 오면 그 토큰을 지우고 연결 버튼을 다시 보냅니다.
- `emoji.list` 결과는 10분 동안 캐시합니다. 캐시에 없는 이름이 들어오면 30초에 한 번까지 다시 조회해서, 방금 추가한 이모지도 찾습니다.

## 권한

| 토큰 | 권한 | 쓰는 곳 |
| --- | --- | --- |
| 봇 | `commands` | 슬래시 커맨드 받기 |
| 봇 | `emoji:read` | 커스텀 이모지 목록 조회 |
| 사용자 | `chat:write` | `/big` 메시지를 내 이름으로 올리기 |

앱은 사용자 토큰을 이모지를 올리는 데만 씁니다. 메시지를 읽는 권한은 받지 않습니다.

## 설치

1. https://api.slack.com/apps 에서 **Create New App → From a manifest**를 고르고 `manifest.yml`을 붙여 넣습니다. `redirect_urls`는 실제 공개 주소로 바꿉니다.
2. **Basic Information → App-Level Tokens**에서 `connections:write` 권한으로 토큰을 만듭니다. → `SLACK_APP_TOKEN` (`xapp-…`)
3. **Install to Workspace** 후 **OAuth & Permissions**의 Bot User OAuth Token → `SLACK_BOT_TOKEN` (`xoxb-…`)
4. **Basic Information**의 Client ID / Client Secret → `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
5. 환경 변수를 채우고 실행합니다. Node 22 이상이 필요합니다.

```sh
cp .env.example .env
# STATE_SECRET 은 아무 긴 난수: openssl rand -hex 32
# PUBLIC_URL 은 콜백이 열리는 HTTPS 주소 (예: https://big-emoji.example.com)
npm install
npm start
```

로그에 `/big 준비됨. OAuth 콜백: https://…`가 나오면 준비된 것입니다. `OAuth 꺼짐`이 나오면 `SLACK_CLIENT_SECRET`, `STATE_SECRET`, `PUBLIC_URL` 중 빈 값이 있는 것입니다. 이때는 새 사용자가 연결할 수 없습니다.

## 환경 변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | ✓ | 봇 토큰. `emoji.list` 조회와 OAuth 교환에 씁니다. |
| `SLACK_APP_TOKEN` | ✓ | Socket Mode 연결용 앱 토큰 |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | 연결용 | 사용자 OAuth |
| `STATE_SECRET` | 연결용 | 연결 버튼 서명용 비밀값. 바꾸면 이미 보낸 버튼만 무효가 됩니다. |
| `PUBLIC_URL` | 연결용 | 콜백이 열리는 HTTPS 주소 |
| `PORT` | | 콜백 HTTP 서버 포트 (기본 `3000`) |
| `SLASH_COMMAND` | | 커맨드 이름 (기본 `/big`, Slack 앱 설정과 같아야 함) |
| `TOKEN_FILE` | | 사용자 토큰 저장 위치 (기본 `data/tokens.json`) |
| `LOG_LEVEL` | | Bolt 로그 레벨 (기본 `info`) |

## 코드 구조

| 파일 | 내용 |
| --- | --- |
| `src/app.js` | Bolt 앱, 커맨드 처리, OAuth 콜백, 메시지 올리기 |
| `src/emoji.js` | 이모지 이름 파싱, 별칭 따라가기, `emoji.list` 캐시 |
| `src/state.js` | 연결 버튼 `state` 서명과 검증 |
| `src/tokens.js` | 사용자 토큰 파일 저장소 |
| `manifest.yml` | Slack 앱 설정 (커맨드, 권한, Socket Mode) |

## 테스트

```sh
npm test
```

## 라이선스

MIT
