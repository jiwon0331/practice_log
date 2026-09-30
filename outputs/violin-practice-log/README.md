# Violin Practice Log

A mobile-first, English-language violin practice journal built with HTML, CSS, and vanilla JavaScript. No installation, build step, external dependencies, or backend is required.

## Open and deploy

Serve this folder using any static web server. For GitHub Pages, put `index.html`, `style.css`, and `script.js` together in the repository folder published by Pages. Relative asset paths support repository subdirectories.

## Use

- Daily opens today's record using the device's local date.
- Use the arrows, Today button, or date picker to select a date.
- Checkmarks and minutes are independent. All minutes count toward the total.
- Notes, time entries, checkmarks, and program edits save automatically.
- Settings supports named sections and editable children in Warm-up and Scales System. Blank edits revert to the last nonempty name.
- Every date gets a deep copy of the program when first opened. Settings changes update today and existing future dates. Older snapshots remain unchanged. Removed items with minutes, a checkmark, or timer data remain in their daily record.
- Start runs a timestamp-based timer for one item. Stop adds elapsed time rounded to the nearest whole minute (under 30 seconds adds zero). Starting another item stops and credits the previous timer. Timers continue across refreshes and closing the page, and always credit the date where they started.
- A read-only grey card shows the exact preceding calendar day's note when present.

## Storage

The app keeps the existing `violinPracticeProgram` and `violinPracticeLogs` keys in localStorage. The active timer is stored as `_activeTimer` inside the logs object, with `itemId`, `date`, and `startedAt`. Timer credit and clearing are saved atomically in the same entry to avoid double credit on refresh. Date records remain keyed by YYYY-MM-DD; consumers should ignore non-date metadata keys. Per-item `timerSeconds` preserves evidence of timed practice even when rounded minutes are zero.

The old single Warm-up is migrated to a group in the current program while keeping its original leaf ID. Historical snapshots are not migrated, and still render normally. Records belong to the current browser and website address. They do not sync between iPhone and iPad. Clearing site data removes the saved records. Use a consistent hosted address for regular practice; direct file access may have browser-specific storage behavior.

Missing data initializes automatically. Invalid stored data falls back to usable defaults with a visible message. If storage is unavailable or full, the app keeps working in memory and reports that changes cannot be saved.

## Verification

- JavaScript syntax check passed.
- Existing completion, manual time, date navigation, and note saving behavior is preserved.
- Automated checks cover legacy migration, historical snapshots, today/future program reconciliation, protected deletions, timer rounding/addition/switching/restoration/date ownership, repeated Stop, exact previous-day notes including leap days and year boundaries, and malformed storage.
- Browser verification covers adding a named section and Warm-up child, renaming and deleting unused items, current Daily updates, reload persistence, ticking timers and single-timer switching, and read-only previous-day notes.
- Daily and Settings checked at 320, 375, 390, 430, 768, and 1024 pixels with no horizontal overflow. Long practice names and running timers were included; inputs and timer buttons stayed inside their cards.
- No JavaScript errors were reported during browser verification.
- HTML, CSS, and JavaScript reviewed for English UI, accessible labels, touch targets, safe areas, and defensive storage handling.
- Responsive browser checks are not physical iPhone/iPad Safari testing. The native date picker's system controls follow the device's language settings; app-authored text is English.
