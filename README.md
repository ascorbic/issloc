# ISS DNS LOC Record Updater

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) that tracks the International Space Station's position in real-time by updating a DNS LOC record every minute. Why? Just for fun and to experiment with DNS LOC records.

Every minute it fetches current ISS position from the [wheretheiss.at API](https://wheretheiss.at/w/developer) and updates the [DNS LOC record](https://blog.cloudflare.com/the-weird-and-wonderful-world-of-dns-loc-records/) via the Cloudflare DNS API.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Domain managed by Cloudflare
- Cloudflare API token with DNS Edit permissions

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create Environment File

Create a `.env` file with your configuration:

```bash
CLOUDFLARE_DNS_API_TOKEN=your-api-token-here
ZONE_ID=your-zone-id-here
RECORD_NAME=iss.yourdomain.com
```

**Finding your Zone ID:**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain
3. Scroll down to find "Zone ID" in the right sidebar (or copy it from the [API section](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/))

### 3. Create Cloudflare API Token

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens) (or [read the guide](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/))
2. Click "Create Token"
3. Use "Edit zone DNS" template
4. Select your zone under "Zone Resources"
5. Click "Continue to summary" then "Create Token"
6. Copy the token and add it to your `.env` file

### 4. Deploy

```bash
pnpm deploy
```

The worker will start updating your DNS LOC record every minute! See [Cloudflare's deployment guide](https://developers.cloudflare.com/workers/wrangler/commands/#deploy) for more details.

## Development

### Run Tests

Tests use the [Cloudflare Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) which runs tests in an actual Workers runtime environment.

```bash
# Run tests once
pnpm test:run

# Run tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Type checking
pnpm typecheck
```
### Local Development & Testing

You can test the scheduled worker locally:

```bash
# Start local development server with scheduled event support
pnpm dev --test-scheduled
```

In another terminal, trigger the scheduled event:

```bash
# Trigger the scheduled handler
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

You'll see the worker:
1. Fetch the current ISS position
2. Convert to LOC format
3. Update the DNS record in real-time (using the real Cloudflare API!)

The `--test-scheduled` flag enables a special endpoint for testing cron triggers locally.

## How It Works

1. **[Scheduled Trigger](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)**: Cloudflare Workers [cron trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) fires every minute
2. **Fetch ISS Position**: Calls [wheretheiss.at API](https://wheretheiss.at/w/developer) for current ISS coordinates (lat/long/altitude)
3. **Convert Coordinates**: Transforms decimal degrees to degrees/minutes/seconds format per [RFC 1876](https://datatracker.ietf.org/doc/html/rfc1876)
4. **Update DNS**: Creates or updates the LOC record via [Cloudflare DNS API](https://developers.cloudflare.com/api/resources/dns/subresources/records/) using structured data
5. **Error Handling**: Logs errors but doesn't fail (skips update if APIs are down)

## DNS LOC Record Format

The LOC record follows [RFC 1876](https://datatracker.ietf.org/doc/html/rfc1876) format.

Cloudflare's API requires a structured `data` object:

```json
{
  "lat_degrees": 33,
  "lat_minutes": 4,
  "lat_seconds": 14,
  "lat_direction": "N",
  "long_degrees": 124,
  "long_minutes": 46,
  "long_seconds": 1,
  "long_direction": "W",
  "altitude": 419493,
  "size": 100,
  "precision_horz": 10000,
  "precision_vert": 10
}
```

This produces the content string:
```
33 4 14.000 N 124 46 1.000 W 419493.00 100.00 10000.00 10.00
```

Where:
- **33 4 14 N**: Latitude (33° 4' 14" North)
- **124 46 1 W**: Longitude (124° 46' 1" West)
- **419493m**: Altitude (419,493 meters ≈ 419.5 km)
- **100m**: Size (approximate diameter of entity)
- **10000m**: Horizontal precision
- **10m**: Vertical precision

## Querying the LOC Record

Once deployed, you can query the LOC record using `dig`:

```bash
dig LOC iss.yourdomain.com

# Or with specific DNS server
dig @1.1.1.1 LOC iss.yourdomain.com
```

Example output:
```
;; ANSWER SECTION:
iss.yourdomain.com.    120    IN    LOC    33 4 14.000 N 124 46 1.000 W 419493.00m 100.00m 10000.00m 10.00m
```

## Configuration Options

### Update Frequency

Edit the [cron expression](https://developers.cloudflare.com/workers/configuration/cron-triggers/#supported-cron-expressions) in `wrangler.jsonc`:

```jsonc
"crons": ["* * * * *"]  // Every minute (current)
```

Options:
- Every 1 minute: `"* * * * *"` (recommended - ISS moves ~460 km/min)
- Every 5 minutes: `"*/5 * * * *"` (ISS moves ~2,300 km)
- Every 15 minutes: `"*/15 * * * *"` (ISS moves ~6,900 km)

**Note**: Cron changes can take up to [15 minutes to propagate](https://developers.cloudflare.com/workers/configuration/cron-triggers/#add-cron-triggers).

### DNS TTL

The TTL is set to 120 seconds (2 minutes) in `src/cloudflare-api.ts`. This is 2× the update interval to prevent clients from caching stale data while allowing some caching efficiency.

To change it, edit the `DNS_TTL` constant in `src/cloudflare-api.ts`.

## Monitoring

View logs and analytics:

```bash
# View real-time logs
pnpm wrangler tail

# View in dashboard
# https://dash.cloudflare.com/ → Workers & Pages → issloc → Logs
```

Learn more about [Workers observability](https://developers.cloudflare.com/workers/observability/) and [Logpush](https://developers.cloudflare.com/workers/observability/logpush/).

## Troubleshooting

### "Failed to list DNS records: 401 Unauthorized"

- Check your API token has DNS Edit permissions
- Verify the token is correct in `.env`
- Ensure the Zone ID matches your domain

### "Failed to list DNS records: 404 Not found"

- Verify your Zone ID is correct (check Cloudflare dashboard)
- Make sure the domain is active on Cloudflare

### "Failed to create/update DNS record"

- Check Worker logs for detailed error message
- Verify the LOC record data structure is valid
- Ensure coordinates are within valid ranges (lat: -90 to 90, long: -180 to 180)

### Cron not triggering

- Cron triggers only work when deployed (not in local dev without `--test-scheduled`)
- Changes can take up to 15 minutes to propagate
- Check the "Triggers" tab in Cloudflare Workers dashboard
- View logs with `pnpm wrangler tail` to confirm execution

### Testing locally

- Use `pnpm dev --test-scheduled` to enable scheduled event testing
- Trigger with: `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`
- Check console output for ISS position and update status

## License

MIT © Matt Kane 2025

## References

- [ISS Position API](https://wheretheiss.at/w/developer)
- [RFC 1876 - LOC Record Specification](https://datatracker.ietf.org/doc/html/rfc1876)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare DNS API](https://developers.cloudflare.com/api/resources/dns/)
- [Cloudflare Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Cloudflare LOC Records Blog](https://blog.cloudflare.com/the-weird-and-wonderful-world-of-dns-loc-records/)
