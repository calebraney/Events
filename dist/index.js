(() => {
  // bin/live-reload.js
  new EventSource(`http://localhost:3000/esbuild`).addEventListener(
    "change",
    () => location.reload()
  );

  // src/utilities.js
  var debugLog = true ? console.log.bind(console) : () => {
  };
  var attr = function(defaultVal, attrVal) {
    const defaultValType = typeof defaultVal;
    if (typeof attrVal !== "string" || attrVal.trim() === "") return defaultVal;
    if (attrVal?.toLowerCase() === "true" && defaultValType === "boolean") return true;
    if (attrVal?.toLowerCase() === "false" && defaultValType === "boolean") return false;
    if (isNaN(attrVal) && defaultValType === "string") return attrVal;
    if (!isNaN(attrVal) && defaultValType === "number") return +attrVal;
    return defaultVal;
  };
  function setDisabledState(el, isDisabled, disabledClass = "is-disabled") {
    if (!el) return;
    el.classList.toggle(disabledClass, isDisabled);
    if (isDisabled) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  }
  function announceLiveRegion(container, message) {
    let region = container.querySelector("[data-live-region]");
    if (!region) {
      region = document.createElement("div");
      region.setAttribute("data-live-region", "");
      region.setAttribute("aria-live", "polite");
      region.className = "u-sr-only";
      container.appendChild(region);
    }
    region.textContent = message;
  }
  function uniquifyIds(root, suffix) {
    if (root.hasAttribute("id")) root.id = `${root.id}-${suffix}`;
    root.removeAttribute("data-w-id");
    root.querySelectorAll("[id]").forEach((el) => {
      el.id = `${el.id}-${suffix}`;
    });
    root.querySelectorAll("[data-w-id]").forEach((el) => {
      el.removeAttribute("data-w-id");
    });
  }

  // src/recurrence.js
  var WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function getOccurrences(event, rangeStart, rangeEnd) {
    const {
      startDate,
      endDate,
      recurringEndDate,
      recurringFrequency = "None",
      recurringInterval = 1,
      recurringDays = [],
      recurringSkipDates = []
    } = event;
    if (!startDate) return [];
    if (!recurringFrequency || recurringFrequency === "None") {
      const occEnd = endDate || startDate;
      if (occEnd < rangeStart || startDate > rangeEnd) return [];
      return [{ start: startDate, end: occEnd }];
    }
    const interval = recurringInterval > 0 ? recurringInterval : 1;
    const skipSet = new Set(recurringSkipDates);
    const startDay = startOfDay(startDate);
    const seriesEndDate = recurringEndDate ? startOfDay(recurringEndDate) : null;
    const endHours = endDate ? endDate.getHours() : startDate.getHours();
    const endMinutes = endDate ? endDate.getMinutes() : startDate.getMinutes();
    const usesRecurringDays = recurringFrequency === "Weekly" && recurringDays.length > 0;
    const endDayOffset = endDate && !usesRecurringDays ? daysBetween(startDay, startOfDay(endDate)) : 0;
    const loopStart = startDate > rangeStart ? startDate : rangeStart;
    const loopEndDate = seriesEndDate && seriesEndDate < rangeEnd ? seriesEndDate : rangeEnd;
    const finalDay = startOfDay(loopEndDate);
    let cursor = loopStart > startDate ? startOfDay(loopStart) : startDay;
    if (cursor > finalDay) return [];
    const targetWeekdays = recurringDays.length ? recurringDays.map((d) => WEEKDAY_INDEX[d]).filter((n) => n !== void 0) : [startDate.getDay()];
    const matchesFrequency = (day) => {
      switch (recurringFrequency) {
        case "Daily":
          return daysBetween(startDay, day) % interval === 0;
        case "Weekly":
          return targetWeekdays.includes(day.getDay()) && weeksBetween(startOfWeek(startDay), startOfWeek(day)) % interval === 0;
        case "Monthly (same date)": {
          const target = Math.min(startDate.getDate(), daysInMonth(day.getFullYear(), day.getMonth()));
          return day.getDate() === target && monthsBetween(startDay, day) % interval === 0;
        }
        case "Monthly (same day of the week)":
          return day.getDay() === startDate.getDay() && Math.ceil(day.getDate() / 7) === Math.ceil(startDate.getDate() / 7) && monthsBetween(startDay, day) % interval === 0;
        case "Yearly": {
          const target = Math.min(startDate.getDate(), daysInMonth(day.getFullYear(), startDate.getMonth()));
          return day.getMonth() === startDate.getMonth() && day.getDate() === target && (day.getFullYear() - startDate.getFullYear()) % interval === 0;
        }
        default:
          return false;
      }
    };
    const results = [];
    while (cursor <= finalDay) {
      if (matchesFrequency(cursor) && !skipSet.has(toDateKey(cursor))) {
        results.push({
          start: combineDateAndTime(cursor, startDate.getHours(), startDate.getMinutes()),
          end: combineDateAndTime(addDays(cursor, endDayOffset), endHours, endMinutes)
        });
      }
      cursor = addDays(cursor, 1);
    }
    return results;
  }
  function parseEventFromJSON(raw) {
    return {
      id: raw.slug || raw.name,
      name: raw.name || "",
      slug: raw.slug || "",
      startDate: parseDynamoDateTime(raw.startDateTime),
      endDate: parseDynamoDateTime(raw.endDateTime),
      recurringEndDate: parseDynamoDate(raw.recurringEndDate),
      showStartTime: parseBool(raw.showStartTime),
      showEndTime: parseBool(raw.showEndTime),
      showEndDate: parseBool(raw.showEndDate),
      eventType: raw.eventType || "",
      shortDescription: raw.shortDescription || "",
      location: raw.location || "",
      address: raw.address || "",
      timezone: raw.timezone || "",
      recurringFrequency: raw.recurringFrequency && raw.recurringFrequency.trim() ? raw.recurringFrequency.trim() : "None",
      recurringInterval: parseRecurringInterval(raw.recurringInterval),
      recurringDays: parseCsv(raw.recurringDays),
      recurringSkipDates: parseCsv(raw.recurringSkipDates)
    };
  }
  function parseDynamoDateTime(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (m) {
      const [, y, mo, d, h, min, ampm] = m;
      let hours = parseInt(h, 10);
      if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
      if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;
      return new Date(+y, +mo - 1, +d, hours, +min);
    }
    const native = new Date(s);
    return isNaN(native.getTime()) ? null : native;
  }
  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  function parseDynamoDate(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    const m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (m) {
      const [, monthName, d, y] = m;
      const monthIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === monthName.toLowerCase());
      if (monthIndex !== -1) return new Date(+y, monthIndex, +d);
    }
    const native = new Date(s);
    return isNaN(native.getTime()) ? null : native;
  }
  function parseRecurringInterval(raw) {
    if (raw === void 0 || raw === null) return 1;
    const trimmed = String(raw).trim();
    if (trimmed === "" || trimmed === "-1") return 1;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function parseCsv(str) {
    if (!str) return [];
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }
  function parseBool(val) {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.trim().toLowerCase() === "true";
    return false;
  }
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function startOfWeek(date) {
    const d = startOfDay(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }
  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
  }
  function weeksBetween(a, b) {
    return Math.round(daysBetween(a, b) / 7);
  }
  function monthsBetween(a, b) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }
  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }
  function combineDateAndTime(day, hours, minutes) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  }
  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // src/event-data.js
  var WRAP = '[data-ix-events="wrap"]';
  var DATA_WRAP = '[data-ix-events="data-wrap"]';
  var ITEM = '[data-ix-events="item"]';
  var DATA_EL = '[data-ix-events="data"]';
  var MAX_ATTEMPTS = 20;
  var RETRY_DELAY = 300;
  function resolveDataWrap(wrap) {
    const all = [...document.querySelectorAll(DATA_WRAP)];
    const local = all.filter((el) => el.closest(WRAP) === wrap);
    if (local.length > 0) {
      if (local.length > 1) {
        console.warn(
          `events: found ${local.length} elements matching ${DATA_WRAP} inside this wrap \u2014 using the first one.`,
          wrap
        );
      }
      debugLog("[event-data] resolveDataWrap \u2014 using LOCAL data-wrap for", wrap, "->", local[0]);
      return local[0];
    }
    const candidates = all.filter((el) => el.closest(WRAP) === null);
    if (candidates.length > 1) {
      console.warn(
        `events: found ${candidates.length} page-level elements matching ${DATA_WRAP} (not nested inside any wrap) \u2014 using the first one. Remove the extras, or nest one inside a specific wrap to scope it there instead.`
      );
    }
    debugLog(
      "[event-data] resolveDataWrap \u2014 no local data-wrap for",
      wrap,
      ", using page-level fallback ->",
      candidates[0] || null,
      `(${candidates.length} unclaimed candidate(s) found)`
    );
    return candidates[0] || null;
  }
  function whenEvents(wrap, callback) {
    let attempts = 0;
    const tryLoad = () => {
      const dataWrap = resolveDataWrap(wrap);
      const items = dataWrap ? [...dataWrap.querySelectorAll(ITEM)] : [];
      if (items.length === 0) {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryLoad, RETRY_DELAY);
          return;
        }
        if (!dataWrap) {
          console.warn(
            `events: no ${DATA_WRAP} found for this wrap \u2014 neither nested inside it, nor at the page level (outside any wrap).`,
            wrap
          );
        }
        callback([]);
        return;
      }
      if (dataWrap.getAttribute("fs-list-element") === "list") {
        window.FinsweetAttributes ||= [];
        window.FinsweetAttributes.push([
          "list",
          (listInstances) => {
            const listInstance = listInstances.find((l) => l.listElement === dataWrap);
            Promise.resolve(listInstance?.loadingPaginatedItems).then(() => finish(dataWrap));
          }
        ]);
        return;
      }
      finish(dataWrap);
    };
    const finish = (dataWrap) => {
      const events = [...dataWrap.querySelectorAll(ITEM)].map((item) => {
        const dataEl = item.querySelector(DATA_EL);
        if (!dataEl) return null;
        try {
          const event = parseEventFromJSON(JSON.parse(dataEl.textContent));
          return event.startDate ? event : null;
        } catch (e) {
          console.warn("events: could not parse event JSON", item, e);
          return null;
        }
      }).filter(Boolean);
      callback(events);
    };
    tryLoad();
  }

  // src/date-utils.js
  var DATE_EL = '[data-ix-events="date"]';
  var DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function startOfDay2(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
  function addDays2(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }
  function startOfWeek2(date, weekStartDay) {
    const diff = (date.getDay() - weekStartDay + 7) % 7;
    return addDays2(date, -diff);
  }
  function anchorFor(date, range, weekStartDay) {
    return range === "week" ? startOfWeek2(date, weekStartDay) : new Date(date.getFullYear(), date.getMonth(), 1);
  }
  function getRangeBounds(current, range) {
    if (range === "week") {
      const weekEnd = addDays2(current, 6);
      return { start: current, end: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59) };
    }
    return {
      start: current,
      end: new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59)
    };
  }
  function stepCurrent(current, range, direction) {
    if (range === "week") return addDays2(current, 7 * direction);
    const next = new Date(current.getFullYear(), current.getMonth(), 1);
    next.setMonth(next.getMonth() + direction);
    return next;
  }
  function stepPeriodEnd(date, period) {
    if (period === "week") return addDays2(date, 7);
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  function stepPeriodStart(date, period) {
    if (period === "week") return addDays2(date, -7);
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    next.setMonth(next.getMonth() - 1);
    return next;
  }
  var SEARCH_CAP = 36;
  function expandingWindowSearch({ anchor, period, direction, targetCount, maxIterations, search }) {
    const isPast = direction === "past";
    let windowStart = isPast ? stepPeriodStart(anchor, period) : anchor;
    let windowEnd = isPast ? anchor : stepPeriodEnd(anchor, period);
    let results = search(windowStart, windowEnd);
    let iterations = 0;
    while (results.length < targetCount && iterations < maxIterations) {
      if (isPast) windowStart = stepPeriodStart(windowStart, period);
      else windowEnd = stepPeriodEnd(windowEnd, period);
      results = search(windowStart, windowEnd);
      iterations++;
    }
    return results;
  }
  var pad2 = (n) => String(n).padStart(2, "0");
  var ordinal = (n) => {
    if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
    if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
    if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
    return `${n}th`;
  };
  var DATE_FORMAT_TOKEN = /YYYY|YY|MMMM|MMM|MM|M|DD|Do|D|dddd|ddd|mm|H|h|A|a/g;
  function formatOccurrenceDate(date, format) {
    const hours = date.getHours();
    const tokens = {
      YYYY: () => String(date.getFullYear()),
      YY: () => String(date.getFullYear()).slice(-2),
      MMMM: () => MONTH_NAMES[date.getMonth()],
      MMM: () => MONTH_SHORT[date.getMonth()],
      MM: () => pad2(date.getMonth() + 1),
      M: () => String(date.getMonth() + 1),
      DD: () => pad2(date.getDate()),
      Do: () => ordinal(date.getDate()),
      D: () => String(date.getDate()),
      dddd: () => DOW_FULL[date.getDay()],
      ddd: () => DOW_SHORT[date.getDay()],
      mm: () => pad2(date.getMinutes()),
      H: () => String(hours),
      h: () => String(hours % 12 || 12),
      A: () => hours >= 12 ? "PM" : "AM",
      a: () => hours >= 12 ? "pm" : "am"
    };
    return format.replace(DATE_FORMAT_TOKEN, (match) => tokens[match]());
  }
  function formatWeekLabel(current, format) {
    const end = addDays2(current, 6);
    if (format) {
      return `${formatOccurrenceDate(current, format)} - ${formatOccurrenceDate(end, format)}`;
    }
    const crossesYear = current.getFullYear() !== end.getFullYear();
    const startFormat = crossesYear ? "MMM D, YYYY" : "MMM D";
    return `${formatOccurrenceDate(current, startFormat)} - ${formatOccurrenceDate(end, "MMM D, YYYY")}`;
  }
  function isFullDateFormat(format) {
    return format.trim().toUpperCase() === "FULLDATE";
  }
  function formatFullDate(occurrence, event) {
    const { start, end } = occurrence;
    const { showStartTime, showEndTime, showEndDate } = event;
    const isMultiDay = showEndDate && startOfDay2(end) !== startOfDay2(start);
    const datePart = isMultiDay ? formatDateRange(start, end) : formatSingleDate(start);
    if (!showStartTime) return datePart;
    if (!showEndTime) return `${datePart} at ${formatClockTime(start)}`;
    const startTime = formatClockTime(start);
    const endTime = formatClockTime(end);
    return `${datePart}, ${hideStartMeridiem(startTime, start, end)}-${endTime}`;
  }
  function hideStartMeridiem(startTimeText, start, end) {
    const startPeriod = start.getHours() >= 12 ? "pm" : "am";
    const endPeriod = end.getHours() >= 12 ? "pm" : "am";
    const start12Hour = start.getHours() % 12 || 12;
    return startPeriod === endPeriod && start12Hour !== 12 ? startTimeText.slice(0, -2) : startTimeText;
  }
  function isTimeFormat(format) {
    const upper = format.trim().toUpperCase();
    return upper === "TIME" || upper === "TIME-SHORT";
  }
  function getTimezoneAbbreviation(date, timeZone) {
    if (!timeZone) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short", hour: "numeric" }).formatToParts(
        date
      );
      return parts.find((p) => p.type === "timeZoneName")?.value || null;
    } catch (e) {
      return null;
    }
  }
  function timezoneSuffix(date, timeZone) {
    const abbr = getTimezoneAbbreviation(date, timeZone);
    return abbr ? ` ${abbr}` : "";
  }
  function formatTimeOnly(occurrence, event, short) {
    if (!event.showStartTime) return null;
    const { start, end } = occurrence;
    const formatSide = short ? formatClockTime : (date) => formatOccurrenceDate(date, "h:mma");
    const startTime = formatSide(start);
    const tzSuffix = timezoneSuffix(start, event.timezone);
    if (!event.showEndTime || end.getTime() === start.getTime()) return startTime + tzSuffix;
    const endTime = formatSide(end);
    return `${hideStartMeridiem(startTime, start, end)}-${endTime}${tzSuffix}`;
  }
  function formatSingleDate(date) {
    return `${MONTH_NAMES[date.getMonth()]} ${ordinal(date.getDate())}`;
  }
  function formatDateRange(start, end) {
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}-${ordinal(end.getDate())}`;
    return `${formatSingleDate(start)} - ${formatSingleDate(end)}`;
  }
  function formatClockTime(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const h12 = hours % 12 || 12;
    const period = hours >= 12 ? "pm" : "am";
    const minuteText = minutes === 0 ? "" : `:${pad2(minutes)}`;
    return `${h12}${minuteText}${period}`;
  }
  function applyDateFormat(el, occurrence, event) {
    const format = attr("MMMM D, YYYY", el.getAttribute("data-ix-events-date-format"));
    if (isTimeFormat(format)) {
      const text = formatTimeOnly(occurrence, event, format.trim().toUpperCase() === "TIME-SHORT");
      el.style.display = text === null ? "none" : "";
      el.textContent = text ?? "";
      return;
    }
    el.style.display = "";
    el.textContent = isFullDateFormat(format) ? formatFullDate(occurrence, event) : formatOccurrenceDate(occurrence.start, format);
  }
  function setDateFields(root, occurrence, event) {
    root.querySelectorAll(DATE_EL).forEach((el) => applyDateFormat(el, occurrence, event));
  }

  // src/event-list.js
  var ANIMATION_ID = "events";
  var LIST_LAYOUT = "list";
  var FEED_LAYOUT = "feed";
  var WRAP2 = '[data-ix-events="wrap"]';
  var LIST_EL = '[data-ix-events="list"]';
  var PREV_BTN = '[data-ix-events="prev"]';
  var NEXT_BTN = '[data-ix-events="next"]';
  var TODAY_BTN = '[data-ix-events="today"]';
  var LABEL = '[data-ix-events="label"]';
  var ITEM2 = '[data-ix-events="item"]';
  var DATA_EL2 = '[data-ix-events="data"]';
  var CARD_EL = '[data-ix-events="card"]';
  var SLUG_ATTR = "data-ix-events-slug";
  var CLONE_ATTR = "data-ix-events-clone";
  var FS_LIST_SELECTOR = '[fs-list-element="list"]';
  var LOAD_MORE_WRAP = '[data-ix-events="load-more-wrap"]';
  var LOAD_MORE_BTN = '[data-ix-events="load-more"]';
  var FEED_DIVIDER_EL = '[data-ix-events="feed-divider"]';
  var FEED_DIVIDER_TEXT_EL = '[data-ix-events="feed-divider-text"]';
  var INITIALIZED_ATTR = "data-ix-events-initialized";
  var ALL_RANGE_YEARS = 3;
  var LIST_DEFAULT_ITEM_COUNT = 30;
  function claimForInit(wrap) {
    if (wrap.hasAttribute(INITIALIZED_ATTR)) return false;
    wrap.setAttribute(INITIALIZED_ATTR, "");
    return true;
  }
  var eventList = function() {
    const wraps = [...document.querySelectorAll(WRAP2)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === LIST_LAYOUT
    );
    debugLog('[event-list] wraps with layout="list" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    wraps.forEach((wrap) => {
      if (!claimForInit(wrap)) {
        debugLog("[event-list] wrap already initialized, skipping:", wrap);
        return;
      }
      const withEvents = (events) => {
        debugLog("[event-list] whenEvents callback fired, events received:", events.length, events);
        const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
        whenListReady(wrap, true, (listInstance) => {
          const config = buildListConfig(wrap, listInstance.listElement, eventsBySlug);
          debugLog("[event-list] config built for wrap:", wrap, "-> ", config);
          if (!config) return;
          initList(config, listInstance);
        });
      };
      if (needsSharedData(wrap)) {
        whenEvents(wrap, withEvents);
      } else {
        debugLog("[event-list] wrap is combined-mode only \u2014 skipping whenEvents()", wrap);
        withEvents([]);
      }
    });
  };
  function buildListConfig(wrap, list, eventsBySlug) {
    const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
    const hidePastEvents = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-hide-past-events`));
    let range = attr("month", wrap.getAttribute(`data-ix-${ANIMATION_ID}-range`)?.toLowerCase());
    if (range !== "month" && range !== "week") range = "month";
    const weekStartDay = attr("sunday", wrap.getAttribute(`data-ix-${ANIMATION_ID}-week-start`)?.toLowerCase()) === "monday" ? 1 : 0;
    const label = wrap.querySelector(LABEL);
    const prevBtn = wrap.querySelector(PREV_BTN);
    const nextBtn = wrap.querySelector(NEXT_BTN);
    const todayBtn = wrap.querySelector(TODAY_BTN);
    const itemCount = readItemCount(wrap, LIST_DEFAULT_ITEM_COUNT);
    const { loadMoreWrap, loadMoreBtn } = itemCount ? resolveLoadMore(wrap) : {};
    debugLog("[event-list] buildListConfig: duplicateRecurring =", duplicateRecurring, "| hidePastEvents =", hidePastEvents, "| range =", range, "| weekStartDay =", weekStartDay, "| itemCount =", itemCount, "| label found:", !!label, "| prevBtn found:", !!prevBtn, "| nextBtn found:", !!nextBtn, "| todayBtn found:", !!todayBtn);
    const entries = buildEntries(wrap, eventsBySlug);
    debugLog("[event-list] buildListConfig: successfully paired entries:", entries.length, entries);
    if (entries.length === 0) return null;
    return {
      wrap,
      duplicateRecurring,
      hidePastEvents,
      range,
      weekStartDay,
      label,
      prevBtn,
      nextBtn,
      todayBtn,
      itemCount,
      loadMoreWrap,
      loadMoreBtn,
      entries,
      list
    };
  }
  function initList(config, listInstance) {
    const {
      wrap,
      duplicateRecurring,
      hidePastEvents,
      range,
      weekStartDay,
      label,
      prevBtn,
      nextBtn,
      todayBtn,
      itemCount,
      loadMoreWrap,
      loadMoreBtn,
      entries,
      list
    } = config;
    const eventByElement = new Map(entries.map(({ item, event }) => [item, event]));
    debugLog("[event-list] initList: registering hook, listInstance =", listInstance);
    label?.setAttribute("aria-live", "polite");
    let current = anchorFor(/* @__PURE__ */ new Date(), range, weekStartDay);
    let renderedCount = itemCount || 0;
    let lastVisibleCount = 0;
    listInstance.addHook("filter", (items) => {
      const { start: rangeStart, end: rangeEnd } = getRangeBounds(current, range);
      debugLog("[event-list] filter hook FIRED. items received from Finsweet:", items.length, items, "| active range:", rangeStart, "-", rangeEnd);
      const removedClones = list.querySelectorAll(`[${CLONE_ATTR}]`);
      debugLog("[event-list] removing stale clones from previous pass:", removedClones.length);
      removedClones.forEach((el) => el.remove());
      const pending = [];
      items.forEach((listItem) => {
        const event = eventByElement.get(listItem.element);
        if (!event) {
          debugLog("[event-list] no matching event for this listItem.element (stale/unrecognized) \u2014 dropping:", listItem.element);
          return;
        }
        let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
        if (hidePastEvents) {
          const now = /* @__PURE__ */ new Date();
          occurrences = occurrences.filter((occ) => occ.end >= now);
        }
        if (!duplicateRecurring) occurrences = occurrences.slice(0, 1);
        debugLog("[event-list] event", event.name, "-> occurrences in range:", occurrences.length);
        occurrences.forEach((occurrence) => {
          pending.push({ listItem, event, occurrence, date: occurrence.start, showStartTime: event.showStartTime });
        });
      });
      pending.sort(compareListEntries);
      const total = pending.length;
      const visibleCount = itemCount ? Math.min(renderedCount, total) : total;
      const visible = pending.slice(0, visibleCount);
      lastVisibleCount = visibleCount;
      items.forEach((listItem) => {
        listItem.element.style.display = "none";
      });
      const claimedOriginal = /* @__PURE__ */ new Set();
      const insertAfterByItem = /* @__PURE__ */ new Map();
      const result = [];
      visible.forEach(({ listItem, event, occurrence, date, showStartTime }) => {
        if (!claimedOriginal.has(listItem)) {
          claimedOriginal.add(listItem);
          listItem.element.style.display = "";
          setDateFields(listItem.element, occurrence, event);
          insertAfterByItem.set(listItem, listItem.element);
          result.push({ listItem, date, showStartTime });
        } else {
          const prevEl = insertAfterByItem.get(listItem);
          const clone = createOccurrenceCard(listItem.element, occurrence, event, `occ-${result.length}`);
          prevEl.insertAdjacentElement("afterend", clone);
          insertAfterByItem.set(listItem, clone);
          result.push({ listItem: listInstance.createItem(clone), date, showStartTime });
        }
      });
      if (itemCount) {
        const target = loadMoreWrap || loadMoreBtn;
        if (target) target.style.display = visibleCount < total ? "" : "none";
      }
      debugLog("[event-list] filter hook RETURNING", result.length, "of", total, "items to Finsweet");
      return result.map((r) => r.listItem);
    });
    const refresh = () => {
      if (itemCount) renderedCount = itemCount;
      debugLog("[event-list] refresh() called \u2014 range now:", current);
      if (label) {
        const format = attr("", label.getAttribute("data-ix-events-label-format"));
        label.textContent = range === "week" ? formatWeekLabel(current, format || void 0) : formatOccurrenceDate(current, format || "MMMM YYYY");
      }
      updateNavState();
      listInstance.triggerHook("filter");
    };
    const updateNavState = () => {
      setDisabledState(prevBtn, isPrevDisabled(current, range, hidePastEvents));
      setDisabledState(todayBtn, isTodayDisabled(current, range));
    };
    refresh();
    prevBtn?.addEventListener("click", () => {
      if (isPrevDisabled(current, range, hidePastEvents)) return;
      current = stepCurrent(current, range, -1);
      refresh();
    });
    nextBtn?.addEventListener("click", () => {
      current = stepCurrent(current, range, 1);
      refresh();
    });
    todayBtn?.addEventListener("click", () => {
      if (isTodayDisabled(current, range)) return;
      current = anchorFor(/* @__PURE__ */ new Date(), range, weekStartDay);
      refresh();
    });
    loadMoreBtn?.addEventListener("click", () => {
      const before = lastVisibleCount;
      renderedCount += itemCount;
      listInstance.triggerHook("filter");
      const added = lastVisibleCount - before;
      if (added > 0) announceLiveRegion(wrap, `${added} more event${added === 1 ? "" : "s"} loaded.`);
    });
  }
  function isPrevDisabled(current, range, hidePastEvents) {
    if (!hidePastEvents) return false;
    const prevBounds = getRangeBounds(stepCurrent(current, range, -1), range);
    return prevBounds.end < /* @__PURE__ */ new Date();
  }
  function isTodayDisabled(current, range) {
    const { start, end } = getRangeBounds(current, range);
    const now = /* @__PURE__ */ new Date();
    return now >= start && now <= end;
  }
  function compareListEntries(a, b) {
    const dayDiff = startOfDay2(a.date) - startOfDay2(b.date);
    if (dayDiff !== 0) return dayDiff;
    if (a.showStartTime !== b.showStartTime) return a.showStartTime ? -1 : 1;
    return a.date - b.date;
  }
  var eventFeed = function() {
    const wraps = [...document.querySelectorAll(WRAP2)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === FEED_LAYOUT
    );
    debugLog('[event-feed] wraps with layout="feed" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    wraps.forEach((wrap) => {
      if (!claimForInit(wrap)) {
        debugLog("[event-feed] wrap already initialized, skipping:", wrap);
        return;
      }
      const withEvents = (events) => {
        debugLog("[event-feed] whenEvents callback fired, events received:", events.length, events);
        const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
        whenListReady(wrap, false, () => initFeed(wrap, eventsBySlug));
      };
      if (needsSharedData(wrap)) {
        whenEvents(wrap, withEvents);
      } else {
        debugLog("[event-feed] wrap is combined-mode only \u2014 skipping whenEvents()", wrap);
        withEvents([]);
      }
    });
  };
  function initFeed(wrap, eventsBySlug) {
    const entries = buildEntries(wrap, eventsBySlug);
    const cardTotal = allCardItems(wrap).length;
    debugLog("[event-feed] initFeed: entries found for wrap:", entries.length, "of", cardTotal, "card item(s) total", wrap);
    if (cardTotal > entries.length) {
      console.warn(
        `event-feed: ${cardTotal - entries.length} card item(s) in this wrap failed to parse into usable events \u2014 see warnings above for which and why. Those cards are hidden (never shown), not included in the feed.`,
        wrap
      );
    }
    if (entries.length === 0) return;
    const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
    const itemCount = readItemCount(wrap, 12);
    let feedPeriod = attr("month", wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-period`)?.toLowerCase());
    if (feedPeriod !== "month" && feedPeriod !== "week") feedPeriod = "month";
    const feedDivider = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider`));
    const feedDividerToday = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider-today`));
    let filter = attr("upcoming", wrap.getAttribute(`data-ix-${ANIMATION_ID}-filter`)?.toLowerCase());
    if (!["upcoming", "past", "all"].includes(filter)) filter = "upcoming";
    let sortDirection = attr("", wrap.getAttribute(`data-ix-${ANIMATION_ID}-sort`)?.toLowerCase());
    if (!["earliest-first", "latest-first"].includes(sortDirection)) sortDirection = void 0;
    const container = wrap.querySelector(LIST_EL) || entries[0].item.parentElement;
    allCardItems(wrap).forEach((item) => {
      item.style.display = "none";
      watchAndKeepHidden(item);
    });
    watchForLateItems(container);
    const { loadMoreWrap, loadMoreBtn } = resolveLoadMore(wrap);
    const loadMoreTarget = loadMoreWrap || loadMoreBtn;
    const dividerTemplate = wrap.querySelector(FEED_DIVIDER_EL);
    const dividerTextEl = dividerTemplate?.querySelector(FEED_DIVIDER_TEXT_EL);
    debugLog("[event-feed] initFeed: duplicateRecurring =", duplicateRecurring, "| itemCount =", itemCount, "| feedPeriod =", feedPeriod, "| feedDivider =", feedDivider, "| feedDividerToday =", feedDividerToday, "| filter =", filter, "| sort =", sortDirection || "(default)", "| loadMoreBtn found:", !!loadMoreBtn, "| dividerTemplate found:", !!dividerTemplate);
    if (feedDivider && !dividerTemplate) {
      console.warn('event-feed: feed-divider is enabled but no [data-ix-events="feed-divider"] element was found.', wrap);
    }
    let renderedCount = 0;
    let currentDividerMonthKey = null;
    let allOccurrencesMerged = null;
    function getAllOccurrencesMerged() {
      if (allOccurrencesMerged) return allOccurrencesMerged;
      const now = /* @__PURE__ */ new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const earliestAllowed = new Date(today.getFullYear() - ALL_RANGE_YEARS, today.getMonth(), today.getDate());
      const cappedEnd = new Date(today.getFullYear() + ALL_RANGE_YEARS, today.getMonth(), today.getDate());
      allOccurrencesMerged = mergeOccurrences(entries, earliestAllowed, cappedEnd, duplicateRecurring, filter, sortDirection);
      return allOccurrencesMerged;
    }
    function createDivider(text) {
      const divider = dividerTemplate.cloneNode(true);
      divider.classList.remove("u-hide");
      divider.style.gridColumn = "1 / -1";
      const textEl = divider.querySelector(FEED_DIVIDER_TEXT_EL);
      if (textEl) textEl.textContent = text;
      return divider;
    }
    function loadMore() {
      const now = /* @__PURE__ */ new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetCount = renderedCount + itemCount;
      const merged = filter === "all" ? getAllOccurrencesMerged() : expandingWindowSearch({
        anchor: today,
        period: feedPeriod,
        direction: filter,
        targetCount,
        maxIterations: SEARCH_CAP,
        search: (start, end) => mergeOccurrences(entries, start, end, duplicateRecurring, filter, sortDirection)
      });
      const batch = merged.slice(renderedCount, targetCount);
      debugLog("[event-feed] loadMore: targetCount =", targetCount, "| total merged occurrences found:", merged.length, "| batch size:", batch.length);
      if (batch.length === 0) {
        if (loadMoreTarget) loadMoreTarget.style.display = "none";
        return;
      }
      batch.forEach(({ item, event, occurrence }, i) => {
        if (feedDivider && dividerTemplate) {
          const monthKey = `${occurrence.start.getFullYear()}-${occurrence.start.getMonth()}`;
          if (currentDividerMonthKey === null || monthKey !== currentDividerMonthKey) {
            const isFirstDividerEver = currentDividerMonthKey === null;
            const format = attr("MMMM, YYYY", dividerTextEl?.getAttribute("data-ix-events-date-format"));
            const showTodayLabel = isFirstDividerEver && feedDividerToday && filter === "upcoming";
            const text = showTodayLabel ? "Today" : formatOccurrenceDate(occurrence.start, format);
            container.appendChild(createDivider(text));
            currentDividerMonthKey = monthKey;
          }
        }
        container.appendChild(createOccurrenceCard(item, occurrence, event, `feed-${renderedCount + i}`));
      });
      renderedCount += batch.length;
      if (batch.length < itemCount && loadMoreTarget) loadMoreTarget.style.display = "none";
    }
    loadMore();
    loadMoreBtn?.addEventListener("click", () => {
      const before = renderedCount;
      loadMore();
      const added = renderedCount - before;
      if (added > 0) announceLiveRegion(wrap, `${added} more event${added === 1 ? "" : "s"} loaded.`);
    });
  }
  function mergeOccurrences(entries, rangeStart, rangeEnd, duplicateRecurring, filter = "upcoming", sortDirection) {
    const now = /* @__PURE__ */ new Date();
    const effectiveSort = sortDirection || (filter === "past" ? "latest-first" : "earliest-first");
    const isDescending = effectiveSort === "latest-first";
    const merged = [];
    entries.forEach(({ item, event }) => {
      let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
      if (filter === "past") occurrences = occurrences.filter((occ) => occ.end < now);
      else if (filter === "upcoming") occurrences = occurrences.filter((occ) => occ.end >= now);
      if (!duplicateRecurring) occurrences = filter === "past" ? occurrences.slice(-1) : occurrences.slice(0, 1);
      occurrences.forEach((occurrence) => merged.push({ item, event, occurrence }));
    });
    merged.sort((a, b) => {
      const dayDiff = startOfDay2(a.occurrence.start) - startOfDay2(b.occurrence.start);
      if (dayDiff !== 0) return isDescending ? -dayDiff : dayDiff;
      if (a.event.showStartTime !== b.event.showStartTime) return a.event.showStartTime ? -1 : 1;
      return isDescending ? b.occurrence.start - a.occurrence.start : a.occurrence.start - b.occurrence.start;
    });
    return merged;
  }
  function needsSharedData(wrap) {
    return [...wrap.querySelectorAll(ITEM2)].some((item) => item.querySelector(CARD_EL) && !item.querySelector(DATA_EL2));
  }
  function allCardItems(wrap) {
    return [...wrap.querySelectorAll(ITEM2)].filter(
      (item) => item.querySelector(CARD_EL) && !item.hasAttribute(CLONE_ATTR)
    );
  }
  function buildEntries(wrap, eventsBySlug) {
    const cardItems = allCardItems(wrap);
    if (cardItems.length === 0) return [];
    return cardItems.map((item) => {
      const dataEl = item.querySelector(DATA_EL2);
      let event;
      if (dataEl) {
        try {
          event = parseEventFromJSON(JSON.parse(dataEl.textContent));
        } catch (e) {
          console.warn("event-list: could not parse event JSON", item, e);
          return null;
        }
      } else {
        const slug = item.getAttribute(SLUG_ATTR);
        event = slug ? eventsBySlug.get(slug) : null;
        if (!event) {
          console.warn(
            `event-list: no matching event data for slug "${slug}" \u2014 bind ${SLUG_ATTR} on this card to the Slug field.`,
            item
          );
          return null;
        }
      }
      if (!event.startDate) {
        console.warn("event-list: event JSON has no valid Start Date \u2014 this card will never be shown.", item);
        return null;
      }
      return { item, event };
    }).filter(Boolean);
  }
  function readItemCount(wrap, defaultValue) {
    const raw = wrap.getAttribute(`data-ix-${ANIMATION_ID}-item-count`);
    if (raw === null || raw.trim() === "") return defaultValue;
    if (raw.trim().toLowerCase() === "unlimited") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : defaultValue;
  }
  function resolveLoadMore(wrap) {
    const loadMoreWrap = [...wrap.querySelectorAll(LOAD_MORE_WRAP)].find((el) => el.closest(WRAP2) === wrap) || null;
    const scope = loadMoreWrap || wrap;
    const loadMoreBtn = [...scope.querySelectorAll(LOAD_MORE_BTN)].find((el) => el.closest(WRAP2) === wrap) || null;
    return { loadMoreWrap, loadMoreBtn };
  }
  function whenListReady(wrap, required, callback) {
    const list = wrap.querySelector(FS_LIST_SELECTOR);
    if (!list) {
      if (required) {
        console.warn('event-list: no element with fs-list-element="list" found inside this wrap.', wrap);
        return;
      }
      callback(null);
      return;
    }
    window.FinsweetAttributes ||= [];
    window.FinsweetAttributes.push([
      "list",
      (listInstances) => {
        const listInstance = listInstances.find((l) => l.listElement === list);
        if (!listInstance) {
          if (required) {
            console.warn(
              'event-list: no Finsweet List instance found for this Collection List \u2014 add fs-list-element="list" to it.',
              list
            );
            return;
          }
          callback(null);
          return;
        }
        Promise.resolve(listInstance.loadingPaginatedItems).then(() => waitForDomSettle(list)).then(() => callback(listInstance));
      }
    ]);
  }
  function createOccurrenceCard(templateItem, occurrence, event, suffix) {
    const clone = templateItem.cloneNode(true);
    clone.style.display = "";
    clone.setAttribute(CLONE_ATTR, "");
    uniquifyIds(clone, suffix);
    setDateFields(clone, occurrence, event);
    watchAndUnhide(clone);
    return clone;
  }
  function watchAndUnhide(el) {
    const observer = new MutationObserver(() => {
      if (el.style.display === "none") el.style.display = "";
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
  }
  function watchAndKeepHidden(el) {
    const observer = new MutationObserver(() => {
      if (el.style.display !== "none") el.style.display = "none";
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
  }
  function waitForDomSettle(container, quietMs = 150, maxWaitMs = 4e3) {
    return new Promise((resolve) => {
      let settled = false;
      let quietTimer;
      const finish = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        resolve();
      };
      const observer = new MutationObserver(() => {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, quietMs);
      });
      observer.observe(container, { childList: true });
      quietTimer = setTimeout(finish, quietMs);
      const maxTimer = setTimeout(finish, maxWaitMs);
    });
  }
  function watchForLateItems(container) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (!node.matches?.(ITEM2)) return;
          if (node.hasAttribute(CLONE_ATTR)) return;
          if (!node.querySelector(CARD_EL)) return;
          node.style.display = "none";
          watchAndKeepHidden(node);
        });
      });
    });
    observer.observe(container, { childList: true });
  }

  // src/event-detail.js
  var ANIMATION_ID2 = "events";
  var DETAIL_LAYOUT = "detail";
  var WRAP3 = '[data-ix-events="wrap"]';
  var DATA_EL3 = '[data-ix-events="data"]';
  var NEXT_DATE_EL = '[data-ix-events="next-date"]';
  var DATES_LIST = '[data-ix-events="dates-list"]';
  var DATES_ITEM = '[data-ix-events="dates-item"]';
  var DATE_EL2 = '[data-ix-events="date"]';
  var LOAD_MORE_WRAP2 = '[data-ix-events="load-more-wrap"]';
  var LOAD_MORE_BTN2 = '[data-ix-events="load-more"]';
  var INITIALIZED_ATTR2 = "data-ix-events-initialized";
  var ALL_RANGE_YEARS2 = 3;
  function claimForInit2(wrap) {
    if (wrap.hasAttribute(INITIALIZED_ATTR2)) return false;
    wrap.setAttribute(INITIALIZED_ATTR2, "");
    return true;
  }
  function queryOwn(scope, selector, boundarySelector = WRAP3) {
    return [...scope.querySelectorAll(selector)].find((el) => el.closest(boundarySelector) === scope) || null;
  }
  function queryOwnAll(scope, selector, boundarySelector = WRAP3) {
    return [...scope.querySelectorAll(selector)].filter((el) => el.closest(boundarySelector) === scope);
  }
  function applyOwnOrNestedDate(el, occurrence, event) {
    if (el.querySelector(DATE_EL2)) {
      setDateFields(el, occurrence, event);
    } else {
      applyDateFormat(el, occurrence, event);
    }
  }
  var eventDetail = function() {
    const wraps = [...document.querySelectorAll(WRAP3)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === DETAIL_LAYOUT
    );
    debugLog('[event-detail] wraps with layout="detail" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    wraps.forEach((wrap) => {
      if (!claimForInit2(wrap)) {
        debugLog("[event-detail] wrap already initialized, skipping:", wrap);
        return;
      }
      const event = parseWrapEvent(wrap);
      if (!event) return;
      renderNextOccurrence(wrap, event);
      queryOwnAll(wrap, DATES_LIST).forEach((listEl, i) => initDatesList(listEl, event, i));
    });
  };
  function parseWrapEvent(wrap) {
    const dataEl = queryOwn(wrap, DATA_EL3);
    if (!dataEl) {
      console.warn('event-detail: no [data-ix-events="data"] found in this wrap.', wrap);
      return null;
    }
    try {
      const event = parseEventFromJSON(JSON.parse(dataEl.textContent));
      if (!event.startDate) {
        console.warn("event-detail: event JSON has no valid Start Date.", wrap);
        return null;
      }
      return event;
    } catch (e) {
      console.warn("event-detail: could not parse event JSON", wrap, e);
      return null;
    }
  }
  function findNextOccurrence(event) {
    if (!event.recurringFrequency || event.recurringFrequency === "None") {
      return { start: event.startDate, end: event.endDate || event.startDate };
    }
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const results = expandingWindowSearch({
      anchor: today,
      period: "month",
      direction: "upcoming",
      targetCount: 1,
      maxIterations: SEARCH_CAP,
      search: (start, end) => getOccurrences(event, start, end).filter((occ) => occ.end >= now).sort((a, b) => a.start - b.start)
    });
    return results[0] || null;
  }
  function renderNextOccurrence(wrap, event) {
    const el = queryOwn(wrap, NEXT_DATE_EL);
    if (!el) return;
    const occurrence = findNextOccurrence(event);
    debugLog("[event-detail] next occurrence for", event.name, ":", occurrence);
    if (!occurrence) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    applyOwnOrNestedDate(el, occurrence, event);
  }
  function buildAllOccurrences(event, sortDirection = "earliest-first") {
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const earliestAllowed = new Date(today.getFullYear() - ALL_RANGE_YEARS2, today.getMonth(), today.getDate());
    const rangeStart = event.startDate > earliestAllowed ? event.startDate : earliestAllowed;
    const cappedEnd = new Date(today.getFullYear() + ALL_RANGE_YEARS2, today.getMonth(), today.getDate());
    const rangeEnd = event.recurringEndDate && event.recurringEndDate < cappedEnd ? event.recurringEndDate : cappedEnd;
    const isDescending = sortDirection === "latest-first";
    return getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => isDescending ? b.start - a.start : a.start - b.start);
  }
  function initDatesList(listEl, event, listIndex) {
    const template = queryOwnAll(listEl, DATES_ITEM, DATES_LIST).find((el) => !el.hasAttribute(CLONE_ATTR)) || null;
    if (!template) return;
    let filter = attr("upcoming", listEl.getAttribute(`data-ix-${ANIMATION_ID2}-filter`)?.toLowerCase());
    if (filter !== "upcoming" && filter !== "past" && filter !== "all") filter = "upcoming";
    let sortDirection = attr("", listEl.getAttribute(`data-ix-${ANIMATION_ID2}-sort`)?.toLowerCase());
    if (sortDirection !== "earliest-first" && sortDirection !== "latest-first") sortDirection = void 0;
    const effectiveSort = sortDirection || (filter === "past" ? "latest-first" : "earliest-first");
    const isDescending = effectiveSort === "latest-first";
    const itemCount = readItemCount(listEl, 12);
    const container = template.parentElement;
    template.style.display = "none";
    const loadMoreWrap = queryOwn(listEl, LOAD_MORE_WRAP2, DATES_LIST);
    const loadMoreBtn = queryOwn(loadMoreWrap || listEl, LOAD_MORE_BTN2, DATES_LIST);
    const loadMoreTarget = loadMoreWrap || loadMoreBtn;
    debugLog("[event-detail] initDatesList: filter =", filter, "| sort =", effectiveSort, "| itemCount =", itemCount, "| loadMoreBtn found:", !!loadMoreBtn);
    const allOccurrences = filter === "all" ? buildAllOccurrences(event, effectiveSort) : null;
    let renderedCount = 0;
    function searchDirected(targetCount) {
      const now = /* @__PURE__ */ new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return expandingWindowSearch({
        anchor: today,
        period: "month",
        direction: filter,
        targetCount,
        maxIterations: SEARCH_CAP,
        search: (start, end) => {
          const occurrences = getOccurrences(event, start, end).filter(
            (occ) => filter === "past" ? occ.end < now : occ.end >= now
          );
          occurrences.sort((a, b) => isDescending ? b.start - a.start : a.start - b.start);
          return occurrences;
        }
      });
    }
    function loadMore() {
      const targetCount = renderedCount + itemCount;
      const source = filter === "all" ? allOccurrences : searchDirected(targetCount);
      const batch = source.slice(renderedCount, targetCount);
      debugLog("[event-detail] loadMore: targetCount =", targetCount, "| total found:", source.length, "| batch size:", batch.length);
      if (batch.length === 0) {
        if (loadMoreTarget) loadMoreTarget.style.display = "none";
        return;
      }
      batch.forEach((occurrence, i) => {
        const clone = createOccurrenceCard(template, occurrence, event, `detail-${listIndex}-${renderedCount + i}`);
        applyOwnOrNestedDate(clone, occurrence, event);
        container.appendChild(clone);
      });
      renderedCount += batch.length;
      if (batch.length < itemCount && loadMoreTarget) loadMoreTarget.style.display = "none";
    }
    loadMore();
    if (renderedCount === 0) listEl.style.display = "none";
    loadMoreBtn?.addEventListener("click", () => {
      const before = renderedCount;
      loadMore();
      const added = renderedCount - before;
      if (added > 0) announceLiveRegion(listEl, `${added} more date${added === 1 ? "" : "s"} loaded.`);
    });
  }

  // src/calendar.js
  var ANIMATION_ID3 = "events";
  var LAYOUT = "calendar";
  var WRAP4 = '[data-ix-events="wrap"]';
  var PREV_BTN2 = '[data-ix-events="prev"]';
  var NEXT_BTN2 = '[data-ix-events="next"]';
  var TODAY_BTN2 = '[data-ix-events="today"]';
  var LABEL2 = '[data-ix-events="label"]';
  var WEEKDAY_LABEL = '[data-ix-events="weekday-label"]';
  var GRID = '[data-ix-events="grid"]';
  var DAY_CELL = '[data-ix-events="day-cell"]';
  var DAY_NUMBER = '[data-ix-events="day-number"]';
  var DAY_PILLS = '[data-ix-events="day-pills"]';
  var DAY_MORE = '[data-ix-events="day-more"]';
  var PILL_TEMPLATE = '[data-ix-events="calendar-pill"]';
  var PILL_SPACER_TEMPLATE = '[data-ix-events="calendar-pill-spacer"]';
  var LOADING = '[data-ix-events="loading"]';
  var DEMO_NOTE = '[data-ix-events="demo-note"]';
  var HOVER_CARD = '[data-ix-events="hover-card"]';
  var FS_LIST_SELECTOR2 = '[fs-list-element="list"]';
  var SLUG_ATTR2 = "data-ix-events-slug";
  var HIDDEN_CLASS = "u-display-none";
  var INITIALIZED_ATTR3 = "data-ix-events-initialized";
  function claimForInit3(wrap) {
    if (wrap.hasAttribute(INITIALIZED_ATTR3)) return false;
    wrap.setAttribute(INITIALIZED_ATTR3, "");
    return true;
  }
  var PILL_TEXT_FIELDS = {
    name: (event) => event.name,
    slug: (event) => event.slug,
    "event-type": (event) => event.eventType,
    "short-description": (event) => event.shortDescription,
    location: (event) => event.location,
    address: (event) => event.address,
    timezone: (event) => event.timezone,
    "show-start-time": (event) => String(event.showStartTime),
    "show-end-time": (event) => String(event.showEndTime),
    "show-end-date": (event) => String(event.showEndDate),
    "recurring-frequency": (event) => event.recurringFrequency === "None" ? "" : event.recurringFrequency,
    "recurring-interval": (event) => String(event.recurringInterval),
    "recurring-days": (event) => event.recurringDays.join(", "),
    "recurring-skip-dates": (event) => event.recurringSkipDates.join(", ")
  };
  var DOW_SHORT2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var calendar = function() {
    const wraps = [...document.querySelectorAll(WRAP4)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === LAYOUT
    );
    debugLog('[calendar] wraps with layout="calendar" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    wraps.forEach((wrap) => {
      if (!claimForInit3(wrap)) {
        debugLog("[calendar] wrap already initialized, skipping:", wrap);
        return;
      }
      initCalendar(wrap);
    });
  };
  function initCalendar(wrap) {
    const grid = wrap.querySelector(GRID);
    const dayCells = grid ? [...grid.querySelectorAll(DAY_CELL)] : [];
    const pillTemplate = wrap.querySelector(PILL_TEMPLATE);
    const spacerTemplate = wrap.querySelector(PILL_SPACER_TEMPLATE);
    if (!grid || dayCells.length === 0) {
      console.warn('calendar: no [data-ix-events="grid"] with [data-ix-events="day-cell"] children found.', wrap);
      return;
    }
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Event calendar");
    dayCells.forEach((cell, i) => {
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-rowindex", String(Math.floor(i / 7) + 1));
      cell.setAttribute("aria-colindex", String(i % 7 + 1));
    });
    const months = attr(6, wrap.getAttribute(`data-ix-${ANIMATION_ID3}-months`));
    let range = attr("month", wrap.getAttribute(`data-ix-${ANIMATION_ID3}-range`)?.toLowerCase());
    if (range !== "month" && range !== "week") range = "month";
    const weekStartDay = attr("sunday", wrap.getAttribute(`data-ix-${ANIMATION_ID3}-week-start`)?.toLowerCase()) === "monday" ? 1 : 0;
    const dayPillLimit = attr(3, wrap.getAttribute(`data-ix-${ANIMATION_ID3}-day-pill-limit`));
    const linkFormat = attr("/event/{slug}", wrap.getAttribute(`data-ix-${ANIMATION_ID3}-link-format`));
    let overflowMode = attr("expand", wrap.getAttribute(`data-ix-${ANIMATION_ID3}-overflow-items`)?.toLowerCase());
    if (!["hide", "expand", "show"].includes(overflowMode)) overflowMode = "hide";
    const showOutsideMonthEvents = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID3}-show-outside-month`));
    const hideInactiveRow = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID3}-hide-inactive-row`));
    const label = wrap.querySelector(LABEL2);
    label?.setAttribute("aria-live", "polite");
    const prevBtn = wrap.querySelector(PREV_BTN2);
    const nextBtn = wrap.querySelector(NEXT_BTN2);
    const todayBtn = wrap.querySelector(TODAY_BTN2);
    const weekdayLabels = [...wrap.querySelectorAll(WEEKDAY_LABEL)];
    const loadingEl = wrap.querySelector(LOADING);
    const demoNoteEl = wrap.querySelector(DEMO_NOTE);
    const hoverCardsBySlug = /* @__PURE__ */ new Map();
    resolveHoverCards(wrap, hoverCardsBySlug, () => {
      debugLog("[calendar] hover-cards found:", hoverCardsBySlug.size, "| slugs:", [...hoverCardsBySlug.keys()]);
      if (hoverCardsBySlug.size === 0) {
        console.warn(
          `calendar: no [data-ix-events="hover-card"] elements with a resolved data-ix-events-slug were found \u2014 hover cards will never show for this instance. If you haven't yet wrapped the hover-card template in a live Webflow Collection List bound to your Events collection (see the TODO comment in the mockup), that's almost certainly why \u2014 the un-wired template only carries the literal, unresolved "{{wf:Slug}}" text.`,
          wrap
        );
      }
      refresh();
    });
    if (!pillTemplate) {
      console.warn('calendar: no [data-ix-events="calendar-pill"] template found \u2014 no events will render.', wrap);
    }
    if (!spacerTemplate) {
      console.warn(
        'calendar: no [data-ix-events="calendar-pill-spacer"] template found \u2014 lane alignment across a row may look off for days with a gap lane.',
        wrap
      );
    }
    setWeekdayLabels(weekdayLabels, weekStartDay);
    const today = /* @__PURE__ */ new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth() - months, 1);
    const maxDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
    const canGoPrev = (current2) => stepCurrent(current2, range, -1) >= minDate;
    const canGoNext = (current2) => stepCurrent(current2, range, 1) <= maxDate;
    const isTodayActive = (current2) => {
      const { start, end } = getRangeBounds(current2, range);
      return today >= start && today <= end;
    };
    let current = anchorFor(today, range, weekStartDay);
    let state = { events: [] };
    const expandedRows = /* @__PURE__ */ new Set();
    const hoverState = { activeCard: null };
    function updateNavState() {
      setDisabledState(prevBtn, !canGoPrev(current));
      setDisabledState(nextBtn, !canGoNext(current));
      setDisabledState(todayBtn, isTodayActive(current));
    }
    function refresh() {
      if (label) {
        const format = attr("", label.getAttribute("data-ix-events-label-format"));
        label.textContent = range === "week" ? formatWeekLabel(current, format || void 0) : formatOccurrenceDate(current, format || "MMMM YYYY");
      }
      updateNavState();
      renderGrid({
        wrap,
        grid,
        dayCells,
        pillTemplate,
        spacerTemplate,
        hoverCardsBySlug,
        current,
        range,
        weekStartDay,
        dayPillLimit,
        linkFormat,
        overflowMode,
        expandedRows,
        showOutsideMonthEvents,
        hideInactiveRow,
        hoverState,
        events: state.events,
        today
      });
    }
    refresh();
    grid.addEventListener("mouseleave", () => {
      if (hoverState.activeCard) {
        hideHoverCard(hoverState.activeCard);
        hoverState.activeCard = null;
      }
    });
    if (overflowMode === "expand") {
      grid.addEventListener("click", (e) => {
        const moreEl = e.target.closest(DAY_MORE);
        if (!moreEl || !moreEl.classList.contains("is-active")) return;
        const cellIndex = dayCells.indexOf(moreEl.closest(DAY_CELL));
        if (cellIndex === -1) return;
        expandedRows.add(Math.floor(cellIndex / 7));
        refresh();
      });
    }
    prevBtn?.addEventListener("click", () => {
      if (!canGoPrev(current)) return;
      expandedRows.clear();
      current = stepCurrent(current, range, -1);
      refresh();
    });
    nextBtn?.addEventListener("click", () => {
      if (!canGoNext(current)) return;
      expandedRows.clear();
      current = stepCurrent(current, range, 1);
      refresh();
    });
    todayBtn?.addEventListener("click", () => {
      if (isTodayActive(current)) return;
      expandedRows.clear();
      current = anchorFor(/* @__PURE__ */ new Date(), range, weekStartDay);
      refresh();
    });
    whenEvents(wrap, (events) => {
      debugLog("[calendar] whenEvents callback fired, events received:", events.length, events);
      const usedDemo = events.length === 0;
      state.events = usedDemo ? demoEvents() : events;
      loadingEl?.classList.remove("is-active");
      if (usedDemo) demoNoteEl?.classList.add("is-active");
      refresh();
    });
  }
  function setWeekdayLabels(weekdayLabels, weekStartDay) {
    weekdayLabels.forEach((el, i) => {
      el.textContent = DOW_SHORT2[(weekStartDay + i) % 7];
    });
  }
  function cssLengthToPx(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return null;
    if (trimmed.endsWith("rem")) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const num2 = parseFloat(trimmed);
      return Number.isNaN(num2) ? null : num2 * rootFontSize;
    }
    const num = parseFloat(trimmed);
    return Number.isNaN(num) ? null : num;
  }
  function buildHoverCardMap(wrap, map) {
    wrap.querySelectorAll(HOVER_CARD).forEach((card) => {
      unwrapFromHiddenAncestor(card, wrap);
      disableCardFocusability(card);
      const slugEl = card.closest(`[${SLUG_ATTR2}]`);
      const slug = slugEl?.getAttribute(SLUG_ATTR2);
      if (slug) map.set(slug, card);
    });
  }
  var CARD_FOCUSABLE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";
  function disableCardFocusability(card) {
    const targets = card.matches(CARD_FOCUSABLE_SELECTOR) ? [card, ...card.querySelectorAll(CARD_FOCUSABLE_SELECTOR)] : [...card.querySelectorAll(CARD_FOCUSABLE_SELECTOR)];
    targets.forEach((el) => el.setAttribute("tabindex", "-1"));
  }
  function resolveHoverCards(wrap, map, callback) {
    const list = wrap.querySelector(FS_LIST_SELECTOR2);
    if (!list) {
      queueMicrotask(() => {
        buildHoverCardMap(wrap, map);
        callback();
      });
      return;
    }
    window.FinsweetAttributes ||= [];
    window.FinsweetAttributes.push([
      "list",
      (listInstances) => {
        const listInstance = listInstances.find((l) => l.listElement === list);
        Promise.resolve(listInstance?.loadingPaginatedItems).then(() => {
          buildHoverCardMap(wrap, map);
          callback();
        });
        let quietTimer;
        const observer = new MutationObserver(() => {
          clearTimeout(quietTimer);
          const sizeBefore = map.size;
          buildHoverCardMap(wrap, map);
          if (map.size !== sizeBefore) callback();
          quietTimer = setTimeout(() => observer.disconnect(), 2e3);
        });
        observer.observe(list, { childList: true, subtree: true });
        quietTimer = setTimeout(() => observer.disconnect(), 2e3);
      }
    ]);
  }
  function unwrapFromHiddenAncestor(el, wrap) {
    let node = el;
    while (node.parentElement && node.parentElement !== wrap) {
      if (node.parentElement.classList.contains(HIDDEN_CLASS)) {
        wrap.appendChild(node);
        return;
      }
      node = node.parentElement;
    }
  }
  function showHoverCard(card, occurrence, event, pillEl, wrap, hoverState) {
    setDateFields(card, occurrence, event);
    card.classList.remove("is-active", "is-above", "is-below");
    card.style.transition = "none";
    void card.offsetHeight;
    const parent = card.offsetParent || wrap;
    const parentRect = parent.getBoundingClientRect();
    const targetRect = pillEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const gap = cssLengthToPx(getComputedStyle(card).getPropertyValue("--hover-card-gap")) ?? 16;
    card.style.transition = "";
    const rawLeft = targetRect.left - parentRect.left;
    const left = Math.max(0, Math.min(rawLeft, parentRect.width - cardRect.width));
    const showBelow = targetRect.top < window.innerHeight / 2;
    const top = showBelow ? targetRect.bottom - parentRect.top + gap : targetRect.top - parentRect.top - cardRect.height - gap;
    debugLog("[calendar] showHoverCard \u2014 event:", event.name, "| left:", left, "| top:", top, "| showBelow:", showBelow, "| parent:", parent);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.toggle("is-above", !showBelow);
    card.classList.toggle("is-below", showBelow);
    void card.offsetHeight;
    requestAnimationFrame(() => {
      if (hoverState.activeCard === card) card.classList.add("is-active");
    });
  }
  function hideHoverCard(card) {
    card?.classList.remove("is-active");
  }
  function renderGrid({
    wrap,
    grid,
    dayCells,
    pillTemplate,
    spacerTemplate,
    hoverCardsBySlug,
    current,
    range,
    weekStartDay,
    dayPillLimit,
    linkFormat,
    overflowMode,
    expandedRows,
    showOutsideMonthEvents,
    hideInactiveRow,
    hoverState,
    events,
    today
  }) {
    const cellDates = range === "week" ? computeWeekCells(current) : computeMonthCells(current, weekStartDay);
    let cellCount = Math.min(cellDates.length, dayCells.length);
    if (hideInactiveRow && range === "month" && cellCount === 42 && cellDates.slice(35, 42).every((c) => !c.inMonth)) {
      cellCount = 35;
    }
    const baseDate = cellDates[0].date;
    grid.classList.toggle("is-range-week", range === "week");
    dayCells.forEach((cell, i) => {
      if (i >= cellCount) {
        cell.style.display = "none";
        return;
      }
      cell.style.display = "";
      cell.classList.toggle("is-range-week", range === "week");
      const { date, inMonth } = cellDates[i];
      cell.classList.toggle("is-outside", !inMonth);
      const numberEl = cell.querySelector(DAY_NUMBER);
      if (numberEl) {
        numberEl.textContent = String(date.getDate());
        numberEl.classList.toggle("is-today", isSameDay(date, today));
      }
      cell.querySelector(DAY_PILLS)?.replaceChildren();
      const moreEl = cell.querySelector(DAY_MORE);
      if (moreEl) {
        moreEl.textContent = "";
        moreEl.classList.remove("is-active");
        moreEl.removeAttribute("aria-expanded");
      }
    });
    if (!pillTemplate) return;
    const paddedStart = getRangeBounds(stepCurrent(current, range, -1), range).start;
    const paddedEnd = getRangeBounds(stepCurrent(current, range, 1), range).end;
    const inMonthClip = range === "month" && !showOutsideMonthEvents ? inMonthBounds(cellDates) : null;
    const segments = [];
    events.forEach((event) => {
      getOccurrences(event, paddedStart, paddedEnd).forEach((occurrence) => {
        const rawStart = dayIndexOf(baseDate, occurrence.start);
        const rawEnd = dayIndexOf(baseDate, occurrence.end);
        if (rawEnd < 0 || rawStart > cellCount - 1) return;
        let startIndex = Math.max(0, rawStart);
        let endIndex = Math.min(cellCount - 1, rawEnd);
        if (inMonthClip) {
          startIndex = Math.max(startIndex, inMonthClip.first);
          endIndex = Math.min(endIndex, inMonthClip.last);
          if (startIndex > endIndex) return;
        }
        splitIntoSegments(startIndex, endIndex).forEach((seg, i, all) => {
          segments.push({
            ...seg,
            pos: all.length === 1 ? "single" : i === 0 ? "start" : i === all.length - 1 ? "end" : "middle",
            event,
            occurrence
          });
        });
      });
    });
    assignLanes(segments);
    const overflowCount = new Array(cellCount).fill(0);
    const segmentsByDay = Array.from({ length: cellCount }, () => []);
    segments.forEach((seg) => {
      const row = Math.floor(seg.startIndex / 7);
      const rowFullyShown = overflowMode === "show" || expandedRows.has(row);
      if (!rowFullyShown && seg.lane >= dayPillLimit) {
        for (let i = seg.startIndex; i <= seg.endIndex; i++) overflowCount[i]++;
        return;
      }
      for (let i = seg.startIndex; i <= seg.endIndex; i++) segmentsByDay[i].push(seg);
    });
    overflowCount.forEach((count, i) => {
      if (count === 0) return;
      const moreEl = dayCells[i]?.querySelector(DAY_MORE);
      if (!moreEl) return;
      moreEl.textContent = `+${count} more`;
      moreEl.classList.add("is-active");
      if (overflowMode === "expand") {
        const row = Math.floor(i / 7);
        moreEl.setAttribute("aria-expanded", expandedRows.has(row) ? "true" : "false");
      }
    });
    for (let i = 0; i < cellCount; i++) {
      const cell = dayCells[i];
      if (!cell) continue;
      const eventCount = segmentsByDay[i].length + overflowCount[i];
      const dateLabel = formatOccurrenceDate(cellDates[i].date, "dddd, MMMM D, YYYY");
      const countLabel = eventCount === 0 ? "no events" : `${eventCount} event${eventCount === 1 ? "" : "s"}`;
      cell.setAttribute("aria-label", `${dateLabel}, ${countLabel}`);
    }
    const unmatchedSlugs = /* @__PURE__ */ new Set();
    segmentsByDay.forEach((daySegments, dayIndex) => {
      if (daySegments.length === 0) return;
      const pillsEl = dayCells[dayIndex]?.querySelector(DAY_PILLS);
      if (!pillsEl) return;
      daySegments.sort((a, b) => a.lane - b.lane);
      let nextLane = 0;
      daySegments.forEach((seg) => {
        while (nextLane < seg.lane) {
          if (spacerTemplate) pillsEl.appendChild(spacerTemplate.cloneNode(true));
          nextLane++;
        }
        const pos = dayIndex === seg.startIndex && dayIndex === seg.endIndex ? "single" : dayIndex === seg.startIndex ? "start" : dayIndex === seg.endIndex ? "end" : "middle";
        const pill = createPill(pillTemplate, seg, pos, linkFormat, `cal-${dayIndex}-${seg.lane}`);
        pillsEl.appendChild(pill);
        if (!hoverCardsBySlug.has(seg.event.slug)) unmatchedSlugs.add(seg.event.slug);
        const revealCard = () => {
          const card = hoverCardsBySlug.get(seg.event.slug);
          debugLog("[calendar] pill hover/focus \u2014 event:", seg.event.name, "| slug:", seg.event.slug, "| card found:", !!card);
          if (!card) return;
          if (hoverState.activeCard && hoverState.activeCard !== card) {
            hideHoverCard(hoverState.activeCard);
          }
          hoverState.activeCard = card;
          showHoverCard(card, seg.occurrence, seg.event, pill, wrap, hoverState);
        };
        const dismissCard = () => {
          const card = hoverCardsBySlug.get(seg.event.slug);
          debugLog("[calendar] pill unhover/blur \u2014 event:", seg.event.name);
          hideHoverCard(card);
          if (hoverState.activeCard === card) hoverState.activeCard = null;
        };
        pill.addEventListener("mouseenter", revealCard);
        pill.addEventListener("mouseleave", dismissCard);
        pill.addEventListener("focus", revealCard);
        pill.addEventListener("blur", dismissCard);
        nextLane++;
      });
    });
    if (unmatchedSlugs.size > 0) {
      console.warn(
        `calendar: rendered pill(s) for slug(s) with no matching [data-ix-events="hover-card"]: ${[...unmatchedSlugs].join(", ")}. Known hover-card slugs: ${[...hoverCardsBySlug.keys()].join(", ")}`
      );
    }
  }
  function inMonthBounds(cellDates) {
    const first = cellDates.findIndex((c) => c.inMonth);
    let last = first;
    cellDates.forEach((c, i) => {
      if (c.inMonth) last = i;
    });
    return { first, last };
  }
  function computeMonthCells(current, weekStartDay) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const leadingCount = (firstWeekday - weekStartDay + 7) % 7;
    const daysInThisMonth = daysInMonth2(year, month);
    const prevMonthDays = daysInMonth2(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
    const cells = [];
    for (let i = leadingCount - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ date: new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d), inMonth: false });
    }
    for (let d = 1; d <= daysInThisMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: addDays2(last, 1), inMonth: false });
    }
    return cells;
  }
  function computeWeekCells(current) {
    return Array.from({ length: 7 }, (_, i) => ({ date: addDays2(current, i), inMonth: true }));
  }
  function dayIndexOf(baseDate, date) {
    return Math.round((startOfDay2(date) - startOfDay2(baseDate)) / 864e5);
  }
  function splitIntoSegments(startIndex, endIndex) {
    const segments = [];
    let segStart = startIndex;
    for (let idx = startIndex; idx <= endIndex; idx++) {
      const isRowEnd = idx % 7 === 6;
      if (isRowEnd || idx === endIndex) {
        segments.push({ startIndex: segStart, endIndex: idx });
        segStart = idx + 1;
      }
    }
    return segments;
  }
  function sameDayPriority(seg) {
    if (seg.endIndex > seg.startIndex) return 0;
    if (!seg.event.showStartTime) return 1;
    return 2;
  }
  function assignLanes(segments) {
    const byRow = /* @__PURE__ */ new Map();
    segments.forEach((seg) => {
      const row = Math.floor(seg.startIndex / 7);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push(seg);
    });
    byRow.forEach((rowSegments) => {
      rowSegments.sort((a, b) => {
        if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
        const priorityDiff = sameDayPriority(a) - sameDayPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        if (sameDayPriority(a) === 0) return b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
        if (sameDayPriority(a) === 2) return a.occurrence.start - b.occurrence.start;
        return 0;
      });
      const laneEnds = [];
      rowSegments.forEach((seg) => {
        let lane = laneEnds.findIndex((end) => end < seg.startIndex);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(seg.endIndex);
        } else {
          laneEnds[lane] = seg.endIndex;
        }
        seg.lane = lane;
      });
    });
  }
  function createPill(pillTemplate, segment, pos, linkFormat, suffix) {
    const { event, occurrence } = segment;
    const clone = pillTemplate.cloneNode(true);
    uniquifyIds(clone, suffix);
    const hasContent = pos === "start" || pos === "single";
    if (hasContent) {
      setDateFields(clone, occurrence, event);
      Object.entries(PILL_TEXT_FIELDS).forEach(([attrName, getValue]) => {
        setField(clone, `[data-ix-events="${attrName}"]`, getValue(event));
      });
    } else {
      clone.setAttribute("tabindex", "-1");
      clone.setAttribute("aria-hidden", "true");
    }
    clone.href = linkFormat.replace("{slug}", event.slug || "");
    clone.classList.add(`is-${pos}`);
    clone.classList.add(colorClass(event));
    return clone;
  }
  function setField(root, selector, value) {
    const el = root.querySelector(selector);
    if (el) el.textContent = value || "";
  }
  function colorClass(event) {
    const slug = slugify(event.eventType);
    if (slug) return `is-type-${slug}`;
    return `is-color-${simpleHash(event.id) % 3 + 1}`;
  }
  function slugify(str) {
    return (str || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = hash * 31 + str.charCodeAt(i) >>> 0;
    return hash;
  }
  function demoEvents() {
    const today = /* @__PURE__ */ new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    return [
      {
        id: "demo-1",
        name: "Community Meetup",
        slug: "community-meetup",
        startDate: new Date(y, m, 8, 18, 0),
        endDate: new Date(y, m, 8, 20, 0),
        showStartTime: true,
        showEndTime: true,
        showEndDate: false,
        eventType: "Meeting",
        shortDescription: "Join us for our monthly community gathering.",
        location: "Community Center",
        address: "",
        timezone: "",
        recurringFrequency: "None",
        recurringInterval: 1,
        recurringDays: [],
        recurringSkipDates: []
      },
      {
        id: "demo-2",
        name: "Volunteer Week",
        slug: "volunteer-week",
        startDate: new Date(y, m, 20, 9, 0),
        endDate: new Date(y, m, 24, 17, 0),
        showStartTime: false,
        showEndTime: false,
        showEndDate: true,
        eventType: "Workshop",
        shortDescription: "A full week of volunteer opportunities.",
        location: "Various Locations",
        address: "",
        timezone: "",
        recurringFrequency: "None",
        recurringInterval: 1,
        recurringDays: [],
        recurringSkipDates: []
      },
      {
        id: "demo-3",
        name: "Small Group",
        slug: "small-group",
        startDate: new Date(y, m, 3, 18, 0),
        endDate: new Date(y, m, 3, 19, 30),
        showStartTime: true,
        showEndTime: true,
        showEndDate: false,
        eventType: "Meeting",
        shortDescription: "Biweekly small group discussion.",
        location: "Room 204",
        address: "",
        timezone: "",
        recurringFrequency: "Weekly",
        recurringInterval: 2,
        recurringDays: [],
        recurringSkipDates: []
      }
    ];
  }
  function daysInMonth2(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // src/index.js
  function runSafely(name, fn) {
    try {
      fn();
    } catch (e) {
      console.error(`events: ${name}() threw and was stopped \u2014 other views on this page are unaffected.`, e);
    }
  }
  document.addEventListener("DOMContentLoaded", function() {
    runSafely("eventList", eventList);
    runSafely("eventFeed", eventFeed);
    runSafely("eventDetail", eventDetail);
    runSafely("calendar", calendar);
  });
})();
