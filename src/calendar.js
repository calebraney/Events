import { attr } from './utilities';
import { getOccurrences } from './recurrence';
import { whenEvents } from './event-data';

// ============================================================================
// calendar: month-grid Calendar (data-ix-events-layout="calendar")
// ============================================================================
//
// Vanilla JS rebuild of the original Webflow AI React "Event Calendar - UI"
// code component — ported here so it can be maintained directly instead of
// only through prompting, and so it shares the same recurrence engine as
// event-list.js. Reads event data through event-data.js's whenEvents(), the
// same single, page-wide [data-ix-events="data-wrap"] lookup event-list.js
// uses — so a List View / Calendar toggle on one page reads one shared source
// instead of two that could drift apart.
//
// Required structure per instance:
//   [data-ix-events="wrap"] [data-ix-events-layout="calendar"]   mount point — renders its own DOM inside this
//
// Options:
//   data-ix-events-months="6"   how many months back/forward navigation is allowed
// ============================================================================

const ANIMATION_ID = 'events';
const LAYOUT = 'calendar';
const WRAP = '[data-ix-events="wrap"]';

const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVENT_COLOR_VARS = [
  ['--_theme---text--text-accent', '#2563eb'],
  ['--_theme---border--border-secondary', '#6b7280'],
  ['--_theme---text--text-primary', '#1f2937'],
];

let stylesInjected = false;

export const calendar = function () {
  const wraps = [...document.querySelectorAll(WRAP)].filter(
    (wrap) => wrap.getAttribute('data-ix-events-layout') === LAYOUT
  );
  if (wraps.length === 0) return;

  injectStyles();

  wraps.forEach((wrap) => initCalendar(wrap));
};

function initCalendar(wrap) {
  const monthRange = attr(6, wrap.getAttribute(`data-ix-${ANIMATION_ID}-months`));

  const today = new Date();
  const state = { year: today.getFullYear(), month: today.getMonth(), events: [], loading: true };

  wrap.classList.add('ix-calendar');
  wrap.style.position = 'relative';
  wrap.innerHTML = '';

  const header = buildHeader();
  const grid = buildGrid();
  const loadingEl = buildLoadingOverlay();
  const tooltip = buildTooltip();

  wrap.append(header.el, grid.weekdayRow, grid.gridEl, loadingEl, tooltip.el);

  const minMonth = new Date(today.getFullYear(), today.getMonth() - monthRange, 1);
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + monthRange, 1);
  const canGoPrev = () => new Date(state.year, state.month - 1, 1) >= minMonth;
  const canGoNext = () => new Date(state.year, state.month + 1, 1) <= maxMonth;

  header.prevBtn.addEventListener('click', () => {
    if (!canGoPrev()) return;
    shiftMonth(-1);
    render();
  });
  header.nextBtn.addEventListener('click', () => {
    if (!canGoNext()) return;
    shiftMonth(1);
    render();
  });

  function shiftMonth(delta) {
    const d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
  }

  function render() {
    header.label.textContent = `${MONTH_FULL[state.month]} ${state.year}`;
    header.prevBtn.disabled = !canGoPrev();
    header.nextBtn.disabled = !canGoNext();

    // Widen the occurrence-collection window by a month on each side so a
    // multi-day event that crosses into this month still renders correctly.
    const rangeStart = new Date(state.year, state.month - 1, 1);
    const rangeEnd = new Date(state.year, state.month + 2, 0, 23, 59, 59);

    const occurrences = [];
    state.events.forEach((event) => {
      getOccurrences(event, rangeStart, rangeEnd).forEach((occ) => {
        occurrences.push({ event, start: occ.start, end: occ.end });
      });
    });

    renderGrid(grid, state.year, state.month, occurrences, today, tooltip, wrap);
  }

  render(); // render an empty grid immediately, then fill in once events load

  whenEvents((events) => {
    const usedDemo = events.length === 0;
    state.events = usedDemo ? demoEvents() : events;
    state.loading = false;
    loadingEl.style.display = 'none';
    if (usedDemo) {
      const note = document.createElement('p');
      note.className = 'ix-calendar_demo-note';
      note.textContent = 'No events data-wrap found on this page — showing sample data.';
      wrap.append(note);
    }
    render();
  });
}

// ── DOM builders ─────────────────────────────────────────────────────────

function buildHeader() {
  const el = document.createElement('div');
  el.className = 'ix-calendar_header';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'ix-calendar_nav-btn';
  prevBtn.setAttribute('aria-label', 'Previous month');
  prevBtn.innerHTML = arrowSvg('M15 18l-6-6 6-6');

  const label = document.createElement('h2');
  label.className = 'ix-calendar_label';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'ix-calendar_nav-btn';
  nextBtn.setAttribute('aria-label', 'Next month');
  nextBtn.innerHTML = arrowSvg('M9 18l6-6-6-6');

  el.append(prevBtn, label, nextBtn);
  return { el, prevBtn, label, nextBtn };
}

function arrowSvg(path) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

function buildGrid() {
  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'ix-calendar_weekdays';
  DOW_SHORT.forEach((d) => {
    const cell = document.createElement('div');
    cell.className = 'ix-calendar_weekday';
    cell.textContent = d;
    weekdayRow.append(cell);
  });

  const gridEl = document.createElement('div');
  gridEl.className = 'ix-calendar_grid';

  return { weekdayRow, gridEl };
}

function buildLoadingOverlay() {
  const el = document.createElement('div');
  el.className = 'ix-calendar_loading';
  el.textContent = 'Loading events…';
  return el;
}

function buildTooltip() {
  const el = document.createElement('div');
  el.className = 'ix-calendar_tooltip';
  el.style.display = 'none';
  return { el };
}

// ── Grid rendering ──────────────────────────────────────────────────────

function renderGrid(grid, year, month, occurrences, today, tooltip, wrap) {
  grid.gridEl.innerHTML = '';

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInThisMonth = daysInMonth(year, month);
  const prevMonthDays = daysInMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    cells.push({
      date: new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d),
      inMonth: false,
    });
  }
  for (let d = 1; d <= daysInThisMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: addDays(last, 1), inMonth: false });
  }

  cells.forEach((cell, i) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'ix-calendar_day';
    if (!cell.inMonth) dayEl.classList.add('is-outside');
    if ((i + 1) % 7 === 0) dayEl.classList.add('is-last-col');

    const isToday = cell.inMonth && isSameDay(cell.date, today);
    const numberEl = document.createElement('div');
    numberEl.className = 'ix-calendar_day-number-row';
    const numberBadge = document.createElement('span');
    numberBadge.className = 'ix-calendar_day-number' + (isToday ? ' is-today' : '');
    numberBadge.textContent = String(cell.date.getDate());
    numberEl.append(numberBadge);
    dayEl.append(numberEl);

    if (cell.inMonth) {
      const dayOccurrences = occurrences.filter((o) => dayInRange(cell.date, o.start, o.end));
      const eventsEl = document.createElement('div');
      eventsEl.className = 'ix-calendar_day-events';

      dayOccurrences.slice(0, 2).forEach((occ) => {
        eventsEl.append(buildEventPill(occ, cell.date, occurrences, tooltip, wrap));
      });
      if (dayOccurrences.length > 2) {
        const more = document.createElement('span');
        more.className = 'ix-calendar_more';
        more.textContent = `+${dayOccurrences.length - 2} more`;
        eventsEl.append(more);
      }
      dayEl.append(eventsEl);
    }

    grid.gridEl.append(dayEl);
  });
}

function buildEventPill(occ, cellDate, allOccurrences, tooltip, wrap) {
  const isStart = isSameDay(cellDate, occ.start);
  const isEnd = isSameDay(cellDate, occ.end);
  const pos = isStart && isEnd ? 'single' : isStart ? 'start' : isEnd ? 'end' : 'middle';
  const color = EVENT_COLOR_VARS[simpleHash(occ.event.id) % EVENT_COLOR_VARS.length];

  const pill = document.createElement('a');
  pill.className = `ix-calendar_pill is-${pos}`;
  pill.href = `/event/${occ.event.slug}`;
  pill.style.setProperty('--pill-color', `var(${color[0]}, ${color[1]})`);
  pill.textContent = pos === 'single' || pos === 'start' ? occ.event.name : ' ';

  pill.addEventListener('mouseenter', () => showTooltip(tooltip, occ, pill, wrap));
  pill.addEventListener('mouseleave', () => hideTooltip(tooltip));

  return pill;
}

function showTooltip(tooltip, occ, targetEl, wrap) {
  const { event, start, end } = occ;
  const wrapRect = wrap.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  let dateText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!isSameDay(start, end))
    dateText += ` – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (event.showStartTime) dateText += ` · ${formatTime(start)}`;
  if (event.showEndTime && !isSameDay(start, end)) dateText += ` – ${formatTime(end)}`;
  else if (event.showEndTime && event.showStartTime && end.getTime() !== start.getTime())
    dateText += ` – ${formatTime(end)}`;

  tooltip.el.innerHTML = `
    <h3 class="ix-calendar_tooltip-title">${escapeHtml(event.name)}</h3>
    <div class="ix-calendar_tooltip-meta">${escapeHtml(dateText)}</div>
    ${
      event.location
        ? `<div class="ix-calendar_tooltip-meta">${escapeHtml(event.location)}</div>`
        : ''
    }
    ${
      event.shortDescription
        ? `<p class="ix-calendar_tooltip-desc">${escapeHtml(event.shortDescription)}</p>`
        : ''
    }
  `;

  const tooltipWidth = 256;
  const rawX = targetRect.left - wrapRect.left + targetRect.width / 2;
  const clampedX = Math.max(tooltipWidth / 2, Math.min(rawX, wrapRect.width - tooltipWidth / 2));

  tooltip.el.style.left = `${clampedX}px`;
  tooltip.el.style.top = `${targetRect.top - wrapRect.top}px`;
  tooltip.el.style.display = 'block';
}

function hideTooltip(tooltip) {
  tooltip.el.style.display = 'none';
}

// ── Demo fallback ───────────────────────────────────────────────────────

function demoEvents() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  return [
    {
      id: 'demo-1',
      name: 'Community Meetup',
      slug: 'community-meetup',
      startDate: new Date(y, m, 8, 18, 0),
      endDate: new Date(y, m, 8, 20, 0),
      showStartTime: true,
      showEndTime: true,
      showEndDate: false,
      shortDescription: 'Join us for our monthly community gathering.',
      location: 'Community Center',
      timezone: '',
      recurringFrequency: 'None',
      recurringInterval: 1,
      recurringDays: [],
      recurringSkipDates: [],
    },
    {
      id: 'demo-2',
      name: 'Volunteer Week',
      slug: 'volunteer-week',
      startDate: new Date(y, m, 20, 9, 0),
      endDate: new Date(y, m, 24, 17, 0),
      showStartTime: false,
      showEndTime: false,
      showEndDate: true,
      shortDescription: 'A full week of volunteer opportunities.',
      location: 'Various Locations',
      timezone: '',
      recurringFrequency: 'None',
      recurringInterval: 1,
      recurringDays: [],
      recurringSkipDates: [],
    },
    {
      id: 'demo-3',
      name: 'Small Group',
      slug: 'small-group',
      startDate: new Date(y, m, 3, 18, 0),
      endDate: new Date(y, m, 3, 19, 30),
      showStartTime: true,
      showEndTime: true,
      showEndDate: false,
      shortDescription: 'Biweekly small group discussion.',
      location: 'Room 204',
      timezone: '',
      recurringFrequency: 'Weekly',
      recurringInterval: 2,
      recurringDays: [],
      recurringSkipDates: [],
    },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dayInRange(day, start, end) {
  const d = startOfDay(day);
  return d >= startOfDay(start) && d <= startOfDay(end);
}
function formatTime(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Styles ──────────────────────────────────────────────────────────────
// Uses the site's real theme tokens (the --_theme---... family, set by e.g.
// a .u-theme-dark class on an ancestor), each with a fallback, rather than
// generic invented variables — so this drops into an existing project's
// theming as-is instead of needing a separate palette maintained in parallel.

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.ix-calendar {
  font-family: inherit;
  color: var(--_theme---text--text-primary, #1f2937);
}
.ix-calendar_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--_theme---border--border-primary, #e5e7eb);
}
.ix-calendar_label {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.ix-calendar_nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--_theme---button-secondary--border, var(--_theme---border--border-primary, #e5e7eb));
  background: var(--_theme---button-secondary--background, transparent);
  color: var(--_theme---icon--icon-primary, var(--_theme---text--text-primary, #1f2937));
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.ix-calendar_nav-btn:hover:not(:disabled) {
  background: var(--_theme---button-secondary--background-hover, var(--_theme---text--text-primary, #1f2937));
  border-color: var(--_theme---button-secondary--border-hover, transparent);
  color: var(--_theme---button-secondary--text-hover, var(--_theme---background--background-primary, #fff));
}
.ix-calendar_nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ix-calendar_weekdays,
.ix-calendar_grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.ix-calendar_weekday {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0;
  color: var(--_theme---text--text-faded, #9ca3af);
}
.ix-calendar_grid {
  border-top: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-left: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-radius: 0.5rem;
  overflow: hidden;
}
.ix-calendar_day {
  min-height: 5.5rem;
  padding: 0.375rem;
  border-right: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-bottom: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  background: var(--_theme---background--background-primary, #fff);
}
.ix-calendar_day.is-outside {
  background: var(--_theme---background--background-secondary, #f9fafb);
}
.ix-calendar_day-number-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.25rem;
}
.ix-calendar_day-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--_theme---text--text-faded, #9ca3af);
}
.ix-calendar_day:not(.is-outside) .ix-calendar_day-number {
  color: var(--_theme---text--text-primary, #1f2937);
}
.ix-calendar_day-number.is-today {
  width: 1.625rem;
  height: 1.625rem;
  font-weight: 700;
  border-radius: 100vw;
  background: var(--_theme---text--text-primary, #1f2937);
  color: var(--_theme---background--background-primary, #fff);
}
.ix-calendar_day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ix-calendar_pill {
  display: block;
  font-size: 0.625rem;
  font-weight: 500;
  line-height: 1.3;
  padding: 2px 4px;
  background: var(--pill-color);
  color: #fff;
  text-decoration: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}
.ix-calendar_pill.is-single { border-radius: 3px; }
.ix-calendar_pill.is-start { border-radius: 3px 0 0 3px; margin-right: -0.375rem; }
.ix-calendar_pill.is-end { border-radius: 0 3px 3px 0; margin-left: -0.375rem; }
.ix-calendar_pill.is-middle { border-radius: 0; margin-left: -0.375rem; margin-right: -0.375rem; }
.ix-calendar_more {
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--_theme---text--text-faded, #6b7280);
  padding-left: 2px;
}
.ix-calendar_loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--_theme---background--background-skeleton, rgba(255, 255, 255, 0.7));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--_theme---text--text-faded, #6b7280);
  z-index: 10;
}
.ix-calendar_demo-note {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--_theme---text--text-faded, #6b7280);
  background: var(--_theme---background--background-secondary, #f9fafb);
  border-radius: 0.375rem;
  border: 1px solid var(--_theme---border--border-primary, #e5e7eb);
}
.ix-calendar_tooltip {
  position: absolute;
  transform: translate(-50%, -100%) translateY(-8px);
  z-index: 50;
  width: 16rem;
  padding: 0.75rem;
  background: var(--_theme---background--background-primary, #fff);
  border: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-radius: 0.375rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
}
.ix-calendar_tooltip-title {
  margin: 0 0 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--_theme---text--text-primary, #1f2937);
}
.ix-calendar_tooltip-meta {
  font-size: 0.6875rem;
  color: var(--_theme---text--text-faded, #6b7280);
  margin-bottom: 0.375rem;
}
.ix-calendar_tooltip-desc {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--_theme---text--text-faded, #6b7280);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;
  document.head.append(style);
}
