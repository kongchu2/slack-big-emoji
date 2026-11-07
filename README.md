# slack-big-emoji

`/big :party_parrot:` 처럼 입력하면 워크스페이스의 커스텀 이모지를 **본인 이름으로** 채널에 크게 올리는 Slack 앱입니다. GIF도 움직이는 채로 올라갑니다. `/mega :party_parrot:` 는 두 배 크기로 올립니다.

`/bigs :emoji_1: :emoji_2:` 는 이모지를 한 번에 4개까지 첨부 파일로 올려서 옆으로 나란히 보이게 합니다. 찾지 못한 이모지는 본인에게만 보이는 메시지로 알려 주고, `:a::b:` 나 `a, b` 처럼 붙이거나 쉼표로 나눠도 됩니다. `/big`, `/mega` 는 이모지 하나만 받습니다. 사용자 권한 `files:write` 가 필요해서, 그 전에 연결한 사람은 처음 `/bigs` 를 쓸 때 한 번 더 연결합니다.

## 동작

1. `/big :이모지:`를 입력하면 앱이 `emoji.list`에서 이미지 URL을 찾습니다. 별칭(alias)도 따라갑니다.
2. 처음 쓰는 사람에게는 본인만 보이는 연결 버튼을 보냅니다. 연결하면 그 이모지가 바로 올라가고 버튼 메시지는 지워집니다.
3. 그 뒤로는 저장된 사용자 토큰(`chat:write`)으로 이미지 블록 메시지를 올립니다.

- Slack은 이미지 블록을 원본 픽셀 크기로 보여 주고 크기 지정 필드가 없습니다. 그래서 `/mega` 는 서버가 이미지를 두 배로 키워 `data/img` 에 저장하고 `PUBLIC_URL/img/…` 로 제공합니다. 정지 이미지는 lanczos3, GIF는 nearest 로 키웁니다.
- Socket Mode라서 Slack 이벤트를 받는 공개 서버는 필요 없습니다.
- 다만 OAuth 연결이 끝난 뒤 브라우저가 돌아올 **콜백 주소**는 사용자 브라우저에서 열려야 하고, Slack은 HTTPS 주소를 요구합니다. Cloudflare Tunnel이나 Tailscale Funnel로 `PORT`를 열면 됩니다.
- 사용자 토큰은 `data/tokens.json`(권한 600)에 저장합니다. 토큰이 취소되면 지우고 다시 연결 링크를 보냅니다.
- 기본 유니코드 이모지(😀 등)는 아직 안 되고, 커스텀 이모지만 됩니다.
- 슬래시 커맨드는 스레드 안에서는 쓸 수 없습니다.

## 설치

1. https://api.slack.com/apps 에서 **Create New App → From a manifest**를 고르고 `manifest.yml`을 붙여 넣습니다. `redirect_urls`는 실제 공개 주소로 바꿉니다.
2. **Basic Information → App-Level Tokens**에서 `connections:write` 권한으로 토큰을 만듭니다. → `SLACK_APP_TOKEN` (`xapp-…`)
3. **Install to Workspace** 후 **OAuth & Permissions**의 Bot User OAuth Token → `SLACK_BOT_TOKEN` (`xoxb-…`)
4. **Basic Information**의 Client ID / Client Secret → `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
5. 환경 변수를 채우고 실행합니다.

```sh
cp .env.example .env
# STATE_SECRET 은 아무 긴 난수: openssl rand -hex 32
# PUBLIC_URL 은 콜백이 열리는 HTTPS 주소 (예: https://big-emoji.example.com)
npm install
npm start
```

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `SLACK_BOT_TOKEN` | 봇 토큰. `emoji.list` 조회와 OAuth 교환에 씁니다. |
| `SLACK_APP_TOKEN` | Socket Mode 연결용 앱 토큰 |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | 사용자 OAuth용 |
| `STATE_SECRET` | 연결 링크 서명용 비밀값 |
| `PUBLIC_URL` | 콜백(`/slack/oauth/callback`)이 열리는 HTTPS 주소 |
| `PORT` | 콜백 HTTP 서버 포트 (기본 3000) |
| `SLASH_COMMAND` | 커맨드 이름 (기본 `/big`, manifest와 같아야 함) |
| `MEGA_COMMAND` | 두 배 커맨드 이름 (기본 `/mega`, manifest와 같아야 함) |
| `FILES_COMMAND` | 첨부 파일로 나란히 올리는 커맨드 이름 (기본 `/bigs`, manifest와 같아야 함) |
| `TOKEN_FILE` | 사용자 토큰 저장 위치 (기본 `data/tokens.json`) |
| `IMAGE_DIR` | 키운 이미지 저장 위치 (기본 `data/img`) |

## 테스트

```sh
npm test
```
