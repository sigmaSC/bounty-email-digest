# bounty-email-digest

Email digest service for the AI Bounty Board. Sends daily or weekly email digests of new bounties matching subscriber tag preferences via the Resend API.

## Features

- Subscriber management: add/remove email subscribers with tag preferences
- Tag-based filtering: only receive bounties matching your interests
- Daily or weekly digest frequency per subscriber
- Formatted HTML emails with bounty details, amounts, and tags
- Uses Resend API (free tier: 3,000 emails/month)
- Email preview endpoint for testing
- Dry-run mode when Resend API key is not configured

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
