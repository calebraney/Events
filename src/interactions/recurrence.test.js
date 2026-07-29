import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOccurrences, parseEventFromJSON, parseDynamoDateTime } from './recurrence.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n, date.getHours(), date.getMinutes());
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('Daily, interval 1 — one occurrence per day', () => {
  const anchor = new Date(2026, 0, 1, 9, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 1, 10, 0),
    recurringFrequency: 'Daily',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, anchor, addDays(anchor, 4));
  assert.equal(occ.length, 5);
  occ.forEach((o, i) => {
    assert.equal(dateKey(o.start), dateKey(addDays(anchor, i)));
    assert.equal(o.start.getHours(), 9);
    assert.equal(o.end.getHours(), 10);
  });
});

test('Daily, interval 2 — every other day', () => {
  const anchor = new Date(2026, 0, 1, 9, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 1, 10, 0),
    recurringFrequency: 'Daily',
    recurringInterval: 2,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, anchor, addDays(anchor, 9));
  assert.equal(occ.length, 5);
  assert.deepEqual(
    occ.map((o) => dateKey(o.start)),
    [0, 2, 4, 6, 8].map((n) => dateKey(addDays(anchor, n)))
  );
});

test('Weekly, single day (no Recurring Days set) — defaults to Start Date weekday', () => {
  const anchor = new Date(2026, 0, 6, 18, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 6, 20, 0),
    recurringFrequency: 'Weekly',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  // exactly 4 full weeks (28 days) always contains exactly 4 occurrences of a single weekday
  const occ = getOccurrences(event, anchor, addDays(anchor, 27));
  assert.equal(occ.length, 4);
  occ.forEach((o) => assert.equal(o.start.getDay(), anchor.getDay()));
  assert.equal(dateKey(occ[0].start), dateKey(anchor));
  assert.equal(dateKey(occ[3].start), dateKey(addDays(anchor, 21)));
});

test('Weekly, multi-day (Recurring Days = two weekdays) — the Tue/Thu case', () => {
  const anchor = new Date(2026, 0, 6, 18, 0);
  const otherDow = (anchor.getDay() + 2) % 7;
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 6, 20, 0),
    recurringFrequency: 'Weekly',
    recurringInterval: 1,
    recurringDays: [DOW[anchor.getDay()], DOW[otherDow]],
    recurringSkipDates: [],
  };
  // exactly 4 full weeks contains exactly 4 occurrences of each of the two weekdays
  const occ = getOccurrences(event, anchor, addDays(anchor, 27));
  assert.equal(occ.length, 8);
  occ.forEach((o) => assert.ok([anchor.getDay(), otherDow].includes(o.start.getDay())));
});

test('Weekly, interval 2 — biweekly', () => {
  const anchor = new Date(2026, 0, 6, 18, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 6, 20, 0),
    recurringFrequency: 'Weekly',
    recurringInterval: 2,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, anchor, addDays(anchor, 55)); // 8 weeks
  assert.equal(occ.length, 4);
  assert.deepEqual(
    occ.map((o) => dateKey(o.start)),
    [0, 14, 28, 42].map((n) => dateKey(addDays(anchor, n)))
  );
});

test('Monthly (same date) — clamps to end of short months', () => {
  const anchor = new Date(2026, 0, 31, 9, 0); // Jan 31, 2026 (2026 is not a leap year)
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 31, 10, 0),
    recurringFrequency: 'Monthly (same date)',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, anchor, new Date(2026, 3, 30));
  assert.deepEqual(
    occ.map((o) => dateKey(o.start)),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']
  );
});

test('Monthly (same day of the week) — skips a month where the 5th occurrence doesn\'t exist', () => {
  const anchor = new Date(2026, 0, 30, 9, 0); // Jan 30, 2026 — ceil(30/7) = 5th occurrence of its weekday
  assert.equal(Math.ceil(anchor.getDate() / 7), 5);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 30, 10, 0),
    recurringFrequency: 'Monthly (same day of the week)',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  // February 2026 has 28 days = exactly 4 weeks, so it can never contain a 5th
  // occurrence of any weekday, regardless of which weekday Jan 30 falls on.
  const occ = getOccurrences(event, anchor, new Date(2026, 1, 28));
  assert.equal(occ.length, 1);
  assert.equal(dateKey(occ[0].start), '2026-01-30');
});

test('Yearly — clamps Feb 29 to Feb 28 in a non-leap year', () => {
  const anchor = new Date(2024, 1, 29, 9, 0); // Feb 29, 2024 (leap year)
  const event = {
    startDate: anchor,
    endDate: new Date(2024, 1, 29, 10, 0),
    recurringFrequency: 'Yearly',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, new Date(2025, 0, 1), new Date(2025, 11, 31)); // 2025 is not a leap year
  assert.equal(occ.length, 1);
  assert.equal(dateKey(occ[0].start), '2025-02-28');
});

test('Recurring Skip Dates are actually excluded', () => {
  const anchor = new Date(2026, 0, 1, 9, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 1, 10, 0),
    recurringFrequency: 'Daily',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: ['2026-01-03'],
  };
  const occ = getOccurrences(event, anchor, addDays(anchor, 4));
  assert.equal(occ.length, 4);
  assert.ok(!occ.some((o) => dateKey(o.start) === '2026-01-03'));
});

test('End Date/Time as series cutoff — stops recurring after that date, keeps its time as each occurrence\'s end time', () => {
  const anchor = new Date(2026, 0, 1, 9, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 10, 17, 0), // series ends Jan 10; every occurrence ends 5pm
    recurringFrequency: 'Daily',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, anchor, new Date(2026, 0, 31));
  assert.equal(occ.length, 10);
  assert.equal(dateKey(occ[occ.length - 1].start), '2026-01-10');
  occ.forEach((o) => {
    assert.equal(o.end.getHours(), 17);
    assert.equal(dateKey(o.end), dateKey(o.start)); // same-day end, not the far-future series end date
  });
});

test('No occurrences generated before the event\'s own Start Date', () => {
  const anchor = new Date(2026, 0, 15, 9, 0);
  const event = {
    startDate: anchor,
    endDate: new Date(2026, 0, 15, 10, 0),
    recurringFrequency: 'Weekly',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  // range starts well before Start Date
  const occ = getOccurrences(event, new Date(2026, 0, 1), new Date(2026, 0, 31));
  assert.ok(occ.every((o) => o.start >= anchor));
});

test('Non-recurring event — single occurrence, unmodified', () => {
  const event = {
    startDate: new Date(2026, 0, 1, 9, 0),
    endDate: new Date(2026, 0, 3, 17, 0), // legitimately multi-day, e.g. a 3-day conference
    recurringFrequency: 'None',
    recurringInterval: 1,
    recurringDays: [],
    recurringSkipDates: [],
  };
  const occ = getOccurrences(event, new Date(2026, 0, 1), new Date(2026, 0, 31));
  assert.equal(occ.length, 1);
  assert.equal(occ[0].start.getTime(), event.startDate.getTime());
  assert.equal(occ[0].end.getTime(), event.endDate.getTime());
});

test('parseEventFromJSON — unset Frequency defaults to None, unset/-1 Interval defaults to 1', () => {
  const parsed = parseEventFromJSON({
    name: 'Test',
    slug: 'test',
    startDateTime: '2026-01-01 9:00 am',
    endDateTime: '2026-01-01 10:00 am',
    recurringFrequency: '',
    recurringInterval: '-1',
    recurringDays: '',
    recurringSkipDates: '',
  });
  assert.equal(parsed.recurringFrequency, 'None');
  assert.equal(parsed.recurringInterval, 1);
  assert.deepEqual(parsed.recurringDays, []);
});

test('parseEventFromJSON — Recurring Days CSV parses into an array', () => {
  const parsed = parseEventFromJSON({
    startDateTime: '2026-01-06 6:00 pm',
    endDateTime: '2026-01-06 8:00 pm',
    recurringFrequency: 'Weekly',
    recurringInterval: '2',
    recurringDays: 'Tue,Thu',
    recurringSkipDates: '2026-01-13,2026-01-15',
  });
  assert.equal(parsed.recurringInterval, 2);
  assert.deepEqual(parsed.recurringDays, ['Tue', 'Thu']);
  assert.deepEqual(parsed.recurringSkipDates, ['2026-01-13', '2026-01-15']);
});

test('parseDynamoDateTime — parses the "YYYY-MM-DD h:mm a" format Dynamo emits', () => {
  const d = parseDynamoDateTime('2026-06-02 6:00 pm');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5);
  assert.equal(d.getDate(), 2);
  assert.equal(d.getHours(), 18);
  assert.equal(d.getMinutes(), 0);
});

test('parseDynamoDateTime — noon/midnight edge cases (12 am / 12 pm)', () => {
  assert.equal(parseDynamoDateTime('2026-01-01 12:00 am').getHours(), 0);
  assert.equal(parseDynamoDateTime('2026-01-01 12:00 pm').getHours(), 12);
});

test('parseDynamoDateTime — empty/missing input returns null', () => {
  assert.equal(parseDynamoDateTime(''), null);
  assert.equal(parseDynamoDateTime(undefined), null);
});
