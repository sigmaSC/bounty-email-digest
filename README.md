# bounty-email-digest

Email digest service with **email subscription endpoint**, **tag-based filtering**, **daily/weekly digest options**, and **unsubscribe link** for the AI Bounty Board.

## Features

- **Email subscription endpoint** — REST API to subscribe/unsubscribe with email, tags, and frequency preferences
- **Tag-based filtering** — subscribers only receive bounties matching their tag interests
- **Daily/weekly digest options** — configurable per subscriber (daily or weekly frequency)
- **Unsubscribe link** — every email includes a one-click unsubscribe link
- Formatted HTML emails with bounty details, amounts, and tags
- Uses Resend API (free tier: 3,000 emails/month)
- Email preview endpoint for testing
- Dry-run mode when Resend API key is not configured

## Deploy Instructions

1. Clone the repo: `git clone https://github.com/sigmaSC/bounty-email-digest`
2. Install dependencies: `bun install`
3. Configure environment: `cp .env.example .env` and add your Resend API key
4. Start the server: `bun run start`
5. For production, deploy to any platform supporting Bun (Railway, Fly.io, Render)

## Quick Start

```bash
# Configure environment
cp .env.example .env
# Edit .env with your Resend API key

# Install and run
bun install
bun run start
```

## Subscribe

```bash
curl -X POST http://localhost:3300/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "tags": ["typescript", "python", "ai"],
    "frequency": "daily"
  }'
```

## Unsubscribe

```bash
# By subscriber ID
curl -X DELETE http://localhost:3300/subscribers/sub_xxx

# By email
curl -X POST http://localhost:3300/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

## Preview Digest

Visit `http://localhost:3300/preview?tags=typescript,python` in your browser to see a rendered digest.

## API Endpoints

| Method   | Path                   | Description                       |
|----------|------------------------|-----------------------------------|
| `GET`    | `/subscribers`         | List subscribers (emails masked)  |
| `POST`   | `/subscribers`         | Add a new subscriber              |
| `PATCH`  | `/subscribers/:id`     | Update subscriber preferences     |
| `DELETE` | `/subscribers/:id`     | Remove a subscriber               |
| `POST`   | `/unsubscribe`         | Unsubscribe by email              |
| `POST`   | `/trigger`             | Manually trigger digest run       |
| `GET`    | `/preview`             | Preview digest HTML               |
| `GET`    | `/health`              | Service health check              |

## Configuration

| Variable            | Default                         | Description                     |
|---------------------|--------------------------------|----------------------------------|
| `API_BASE_URL`      | `https://aibountyboard.com/api`| Bounty board API URL             |
| `RESEND_API_KEY`    | (none)                         | Resend API key                   |
| `FROM_EMAIL`        | `bounties@yourdomain.com`      | Sender email address             |
| `PORT`              | `3300`                         | API server port                  |
| `SUBSCRIBERS_FILE`  | `./subscribers.json`           | Subscriber data file             |
| `STATE_FILE`        | `./digest-state.json`          | Digest state file                |
| `CHECK_INTERVAL_MS` | `3600000` (1 hour)             | Digest check interval            |

## Schedule

- **Daily digests**: Sent between 8-9 AM to daily subscribers
- **Weekly digests**: Sent on Mondays between 8-9 AM to weekly subscribers
- New bounties are tracked to avoid sending duplicates

## License

MIT
