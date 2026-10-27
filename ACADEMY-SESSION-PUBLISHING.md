# Training Academy — publish a session

This page is a reference for maintaining `academy-sessions.json` and the public Academy page. No website signup database or Discord synchronization is installed.

## Process

1. Approve the class title, level, prerequisites, dates/times, location, and any capacity. The levels are currently **proposals**.
2. Create a Discord Scheduled Event for the class. For an in-person class, Discord's **Somewhere Else** venue option may be appropriate.
3. Copy the **specific event share link**; do not use an ordinary server invite as the registration link.
4. Add a session object to the `sessions` array in `academy-sessions.json`. Use the schema below, replace every placeholder, and create a pull request for review.
5. Verify the Academy listing links to the correct event. Do not promise a confirmed seat solely based on **Interested**.
6. After the event, remove or archive the listing manually until an archival workflow is approved.

## Session schema

The published file starts as `{"schemaVersion":1,"sessions":[]}`. Add objects with the following fields:

| Field | Meaning |
| --- | --- |
| `title` | Approved course/class title |
| `level` | `foundation`, `development`, or `advanced` |
| `startAt` | ISO 8601 date/time with explicit UTC offset, e.g. `YYYY-MM-DDTHH:mm:ss-06:00` |
| `endAt` | Same format, must be later than `startAt` |
| `timeZone` | IANA time zone, e.g. `America/Chicago` |
| `location` | Approved physical venue or online meeting location |
| `description` | Concise, public class description |
| `prerequisites` | Approved entry requirements, or `None` if explicitly confirmed |
| `status` | `interest`, `full`, or `closed` — manually maintained; not synchronized |
| `eventUrl` | Direct `https://discord.com/events/SERVER_ID/EVENT_ID` link or event-specific `https://discord.gg/INVITE?event=EVENT_ID` link |
| `capacity` | Optional approved integer (do not include when unknown) |

**Example structure — placeholders only, not an actual event:**

```json
{
  "schemaVersion": 1,
  "sessions": [
    {
      "title": "REPLACE WITH APPROVED COURSE NAME",
      "level": "foundation",
      "startAt": "YYYY-MM-DDTHH:mm:ss-06:00",
      "endAt": "YYYY-MM-DDTHH:mm:ss-06:00",
      "timeZone": "America/Chicago",
      "location": "REPLACE WITH CONFIRMED LOCATION",
      "description": "REPLACE WITH APPROVED DESCRIPTION",
      "prerequisites": "REPLACE WITH APPROVED REQUIREMENTS",
      "status": "interest",
      "eventUrl": "https://discord.com/events/SERVER_ID/EVENT_ID"
    }
  ]
}
```

The template is **documentation only**: do not copy it into the live JSON without replacing placeholders and obtaining approval. The renderer rejects malformed dates or non-event Discord links.

## Limits

- Discord `Interested` means interest and notifications, **not** a guaranteed seat, waitlist, attendance, or completion credential.
- Organizers must manage confirmation and class rosters separately until a dedicated system is implemented.
- Listed status and capacity are **manual**, not automatically synchronized with Discord.
- The website does not collect participant names or identifying information.
- The LOCKBOX schedule, rules, faction information, and event ticket process must not change as part of Academy session publication.
