# notify-inactive script

This script calls `apiClient.notifyInactiveUsers(21)` to create notifications for users inactive for 21+ days.

Run locally:

```bash
node scripts/notify-inactive.js
```

Schedule via cron (example, daily at 03:00):

```cron
0 3 * * * cd /path/to/kuidacar && /usr/bin/node scripts/notify-inactive.js >> /var/log/kuidacar/notify-inactive.log 2>&1
```

Supabase Edge Function example:

Create a new function that imports `apiClient` from your deployed code or replicates the `notifyInactiveUsers` logic and schedule it using Supabase scheduled functions.
