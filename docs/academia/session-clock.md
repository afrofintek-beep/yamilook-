# Session clock

Deploy `20261031120726_academia_session_clock.sql` before the frontend. Existing sessions default to 60 planned minutes. No historic start or end time is fabricated; existing live rooms display that the start is unavailable until a newly started session is used.

Mentors select 30, 45, 60, 90 or 120 minutes at creation. The timer begins when the mentor starts the video room, not when each participant connects. The database assigns timestamps and preserves them across repeat start requests and reconnects. Ending freezes the actual duration.

A persistent room header shows planned, elapsed and remaining time, then overtime. Warnings at 10 and 5 minutes do not interrupt media. The mentor can extend by 15 minutes up to eight hours. Existing row security restricts updates; a compare-and-update avoids overwriting another mentor device. The existing five-second room refresh distributes the new duration. No automatic closure, extra charge or billing changes are introduced.

Timing changes append to the existing private session-action audit. The private audit trigger has narrowly scoped definer privileges to append to that protected table. Clock assignment itself runs as invoker and cannot be forged by inserting or updating timestamps.

Validation: `node --test scripts/test-academia-clock.mjs`; `npx vitest run src/features/academia/components/SessionClock.test.tsx src/features/academia/routes/AcademiaLiveRoom.test.tsx src/features/academia/hooks/useAcademia.test.tsx`.

Before release, verify the migration in the deployment database and check one mentor and one participant in a real room, including reconnection and extension. Automated tests do not establish live production deployment or real-device verification.
