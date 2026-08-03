(() => {
  // bin/live-reload.js
  new EventSource(`http://localhost:3000/esbuild`).addEventListener(
    "change",
    () => location.reload()
  );

  // src/utilities.js
  var attr = function(defaultVal, attrVal) {
    const defaultValType = typeof defaultVal;
    if (typeof attrVal !== "string" || attrVal.trim() === "") return defaultVal;
    if (attrVal?.toLowerCase() === "true" && defaultValType === "boolean") return true;
    if (attrVal?.toLowerCase() === "false" && defaultValType === "boolean") return false;
    if (isNaN(attrVal) && defaultValType === "string") return attrVal;
    if (!isNaN(attrVal) && defaultValType === "number") return +attrVal;
    return defaultVal;
  };
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
  var DATA_WRAP = '[data-ix-events="data-wrap"]';
  var ITEM = '[data-ix-events="item"]';
  var DATA_EL = '[data-ix-events="data"]';
  var MAX_ATTEMPTS = 20;
  var RETRY_DELAY = 300;
  function whenEvents(callback) {
    let attempts = 0;
    const tryLoad = () => {
      const dataWraps = document.querySelectorAll(DATA_WRAP);
      if (dataWraps.length > 1) {
        console.warn(
          `events: found ${dataWraps.length} elements matching ${DATA_WRAP} \u2014 using the first one. Remove the extras to avoid duplicate or conflicting event data.`
        );
      }
      const dataWrap = dataWraps[0];
      const items = dataWrap ? [...dataWrap.querySelectorAll(ITEM)] : [];
      if (items.length === 0) {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryLoad, RETRY_DELAY);
          return;
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
  var MONTH_FULL = [
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
      MMMM: () => MONTH_FULL[date.getMonth()],
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
  function formatTimeOnly(occurrence, event, short) {
    if (!event.showStartTime) return null;
    const { start, end } = occurrence;
    const formatSide = short ? formatClockTime : (date) => formatOccurrenceDate(date, "h:mma");
    const startTime = formatSide(start);
    if (!event.showEndTime || end.getTime() === start.getTime()) return startTime;
    const endTime = formatSide(end);
    return `${hideStartMeridiem(startTime, start, end)}-${endTime}`;
  }
  function formatSingleDate(date) {
    return `${MONTH_FULL[date.getMonth()]} ${ordinal(date.getDate())}`;
  }
  function formatDateRange(start, end) {
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) return `${MONTH_FULL[start.getMonth()]} ${start.getDate()}-${ordinal(end.getDate())}`;
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
  function setDateFields(root, occurrence, event) {
    root.querySelectorAll(DATE_EL).forEach((el) => {
      const format = attr("MMMM D, YYYY", el.getAttribute("data-ix-events-date-format"));
      if (isTimeFormat(format)) {
        const text = formatTimeOnly(occurrence, event, format.trim().toUpperCase() === "TIME-SHORT");
        el.style.display = text === null ? "none" : "";
        el.textContent = text ?? "";
        return;
      }
      el.style.display = "";
      el.textContent = isFullDateFormat(format) ? formatFullDate(occurrence, event) : formatOccurrenceDate(occurrence.start, format);
    });
  }

  // src/event-list.js
  var ANIMATION_ID = "events";
  var LIST_LAYOUT = "list";
  var FEED_LAYOUT = "feed";
  var WRAP = '[data-ix-events="wrap"]';
  var PREV_BTN = '[data-ix-events="prev"]';
  var NEXT_BTN = '[data-ix-events="next"]';
  var TODAY_BTN = '[data-ix-events="today"]';
  var LABEL = '[data-ix-events="label"]';
  var ITEM2 = '[data-ix-events="item"]';
  var DATA_EL2 = '[data-ix-events="data"]';
  var CARD_EL = '[data-ix-events="card"]';
  var SLUG_ATTR = "data-ix-events-slug";
  var CLONE_ATTR = "data-ix-events-clone";
  var DISABLED_CLASS = "is-disabled";
  var FS_LIST_SELECTOR = '[fs-list-element="list"]';
  var LOAD_MORE_BTN = '[data-ix-events="load-more"]';
  var FEED_DIVIDER_EL = '[data-ix-events="feed-divider"]';
  var FEED_DIVIDER_TEXT_EL = '[data-ix-events="feed-divider-text"]';
  var FEED_SEARCH_CAP = 36;
  var eventList = function() {
    const wraps = [...document.querySelectorAll(WRAP)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === LIST_LAYOUT
    );
    console.log('[event-list] DEBUG wraps with layout="list" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    whenEvents((events) => {
      console.log("[event-list] DEBUG whenEvents callback fired, events received:", events.length, events);
      const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
      wraps.forEach((wrap) => {
        whenListReady(wrap, true, (listInstance) => {
          const config = buildListConfig(wrap, listInstance.listElement, eventsBySlug);
          console.log("[event-list] DEBUG config built for wrap:", wrap, "-> ", config);
          if (!config) return;
          initList(config, listInstance);
        });
      });
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
    console.log("[event-list] DEBUG buildListConfig: duplicateRecurring =", duplicateRecurring, "| hidePastEvents =", hidePastEvents, "| range =", range, "| weekStartDay =", weekStartDay, "| label found:", !!label, "| prevBtn found:", !!prevBtn, "| nextBtn found:", !!nextBtn, "| todayBtn found:", !!todayBtn);
    const entries = buildEntries(wrap, eventsBySlug);
    console.log("[event-list] DEBUG buildListConfig: successfully paired entries:", entries.length, entries);
    if (entries.length === 0) return null;
    return { duplicateRecurring, hidePastEvents, range, weekStartDay, label, prevBtn, nextBtn, todayBtn, entries, list };
  }
  function initList(config, listInstance) {
    const { duplicateRecurring, hidePastEvents, range, weekStartDay, label, prevBtn, nextBtn, todayBtn, entries, list } = config;
    const eventByElement = new Map(entries.map(({ item, event }) => [item, event]));
    console.log("[event-list] DEBUG initList: registering hook, listInstance =", listInstance);
    let current = anchorFor(/* @__PURE__ */ new Date(), range, weekStartDay);
    listInstance.addHook("filter", (items) => {
      const { start: rangeStart, end: rangeEnd } = getRangeBounds(current, range);
      console.log("[event-list] DEBUG filter hook FIRED. items received from Finsweet:", items.length, items, "| active range:", rangeStart, "-", rangeEnd);
      const removedClones = list.querySelectorAll(`[${CLONE_ATTR}]`);
      console.log("[event-list] DEBUG removing stale clones from previous pass:", removedClones.length);
      removedClones.forEach((el) => el.remove());
      const result = [];
      items.forEach((listItem) => {
        const event = eventByElement.get(listItem.element);
        if (!event) {
          console.log("[event-list] DEBUG no matching event for this listItem.element (stale/unrecognized) \u2014 dropping:", listItem.element);
          return;
        }
        let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
        if (hidePastEvents) {
          const now = /* @__PURE__ */ new Date();
          occurrences = occurrences.filter((occ) => occ.end >= now);
        }
        console.log("[event-list] DEBUG event", event.name, "-> occurrences in range:", occurrences.length);
        listItem.element.style.display = occurrences.length === 0 ? "none" : "";
        if (occurrences.length === 0) return;
        const [first, ...rest] = occurrences;
        setDateFields(listItem.element, first, event);
        result.push({ listItem, date: first.start, showStartTime: event.showStartTime });
        if (duplicateRecurring) {
          let insertAfter = listItem.element;
          rest.forEach((occ, i) => {
            const clone = createOccurrenceCard(listItem.element, occ, event, `occ-${i + 1}`);
            insertAfter.insertAdjacentElement("afterend", clone);
            insertAfter = clone;
            result.push({ listItem: listInstance.createItem(clone), date: occ.start, showStartTime: event.showStartTime });
          });
        }
      });
      result.sort(compareListEntries);
      console.log("[event-list] DEBUG filter hook RETURNING", result.length, "items to Finsweet");
      return result.map((r) => r.listItem);
    });
    const refresh = () => {
      console.log("[event-list] DEBUG refresh() called \u2014 range now:", current);
      if (label) {
        const format = attr("", label.getAttribute("data-ix-events-label-format"));
        label.textContent = range === "week" ? formatWeekLabel(current, format || void 0) : formatOccurrenceDate(current, format || "MMMM YYYY");
      }
      updateNavState();
      listInstance.triggerHook("filter");
    };
    const updateNavState = () => {
      if (prevBtn) prevBtn.classList.toggle(DISABLED_CLASS, isPrevDisabled(current, range, hidePastEvents));
      if (todayBtn) todayBtn.classList.toggle(DISABLED_CLASS, isTodayDisabled(current, range));
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
    const wraps = [...document.querySelectorAll(WRAP)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === FEED_LAYOUT
    );
    console.log('[event-feed] DEBUG wraps with layout="feed" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    whenEvents((events) => {
      console.log("[event-feed] DEBUG whenEvents callback fired, events received:", events.length, events);
      const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
      wraps.forEach((wrap) => {
        whenListReady(wrap, false, () => initFeed(wrap, eventsBySlug));
      });
    });
  };
  function initFeed(wrap, eventsBySlug) {
    const entries = buildEntries(wrap, eventsBySlug);
    console.log("[event-feed] DEBUG initFeed: entries found for wrap:", entries.length, wrap);
    if (entries.length === 0) return;
    const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
    const feedCount = attr(12, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-count`));
    let feedPeriod = attr("month", wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-period`)?.toLowerCase());
    if (feedPeriod !== "month" && feedPeriod !== "week") feedPeriod = "month";
    const feedDivider = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider`));
    const feedDividerToday = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID}-feed-divider-today`));
    const container = entries[0].item.parentElement;
    entries.forEach(({ item }) => {
      item.style.display = "none";
    });
    const loadMoreBtn = wrap.querySelector(LOAD_MORE_BTN);
    const dividerTemplate = wrap.querySelector(FEED_DIVIDER_EL);
    const dividerTextEl = dividerTemplate?.querySelector(FEED_DIVIDER_TEXT_EL);
    console.log("[event-feed] DEBUG initFeed: duplicateRecurring =", duplicateRecurring, "| feedCount =", feedCount, "| feedPeriod =", feedPeriod, "| feedDivider =", feedDivider, "| feedDividerToday =", feedDividerToday, "| loadMoreBtn found:", !!loadMoreBtn, "| dividerTemplate found:", !!dividerTemplate);
    if (feedDivider && !dividerTemplate) {
      console.warn('event-feed: feed-divider is enabled but no [data-ix-events="feed-divider"] element was found.', wrap);
    }
    let renderedCount = 0;
    let currentDividerMonthKey = null;
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
      const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetCount = renderedCount + feedCount;
      let searchEnd = stepPeriodEnd(rangeStart, feedPeriod);
      let merged = mergeOccurrences(entries, rangeStart, searchEnd, duplicateRecurring);
      let iterations = 0;
      while (merged.length < targetCount && iterations < FEED_SEARCH_CAP) {
        searchEnd = stepPeriodEnd(searchEnd, feedPeriod);
        merged = mergeOccurrences(entries, rangeStart, searchEnd, duplicateRecurring);
        iterations++;
      }
      const batch = merged.slice(renderedCount, targetCount);
      console.log("[event-feed] DEBUG loadMore: targetCount =", targetCount, "| total merged occurrences found:", merged.length, "(after", iterations, "extra search steps) | batch size:", batch.length);
      if (batch.length === 0) {
        if (loadMoreBtn) loadMoreBtn.style.display = "none";
        return;
      }
      batch.forEach(({ item, event, occurrence }, i) => {
        if (feedDivider && dividerTemplate) {
          const monthKey = `${occurrence.start.getFullYear()}-${occurrence.start.getMonth()}`;
          if (currentDividerMonthKey === null || monthKey !== currentDividerMonthKey) {
            const isFirstDividerEver = currentDividerMonthKey === null;
            const format = attr("MMMM, YYYY", dividerTextEl?.getAttribute("data-ix-events-date-format"));
            const text = isFirstDividerEver && feedDividerToday ? "Today" : formatOccurrenceDate(occurrence.start, format);
            container.appendChild(createDivider(text));
            currentDividerMonthKey = monthKey;
          }
        }
        container.appendChild(createOccurrenceCard(item, occurrence, event, `feed-${renderedCount + i}`));
      });
      renderedCount += batch.length;
      if (batch.length < feedCount && loadMoreBtn) loadMoreBtn.style.display = "none";
    }
    loadMore();
    loadMoreBtn?.addEventListener("click", loadMore);
  }
  function mergeOccurrences(entries, rangeStart, rangeEnd, duplicateRecurring) {
    const merged = [];
    entries.forEach(({ item, event }) => {
      let occurrences = getOccurrences(event, rangeStart, rangeEnd).sort((a, b) => a.start - b.start);
      if (!duplicateRecurring) occurrences = occurrences.slice(0, 1);
      occurrences.forEach((occurrence) => merged.push({ item, event, occurrence }));
    });
    merged.sort((a, b) => {
      const dayDiff = startOfDay2(a.occurrence.start) - startOfDay2(b.occurrence.start);
      if (dayDiff !== 0) return dayDiff;
      if (a.event.showStartTime !== b.event.showStartTime) return a.event.showStartTime ? -1 : 1;
      return a.occurrence.start - b.occurrence.start;
    });
    return merged;
  }
  function buildEntries(wrap, eventsBySlug) {
    const cardItems = [...wrap.querySelectorAll(ITEM2)].filter((item) => item.querySelector(CARD_EL));
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
      return event.startDate ? { item, event } : null;
    }).filter(Boolean);
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
        Promise.resolve(listInstance.loadingPaginatedItems).then(() => callback(listInstance));
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

  // src/calendar.js
  var ANIMATION_ID2 = "events";
  var LAYOUT = "calendar";
  var WRAP2 = '[data-ix-events="wrap"]';
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
  var SLUG_ATTR2 = "data-ix-events-slug";
  var DISABLED_CLASS2 = "is-disabled";
  var HIDDEN_CLASS = "u-display-none";
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
    "recurring-frequency": (event) => event.recurringFrequency,
    "recurring-interval": (event) => String(event.recurringInterval),
    "recurring-days": (event) => event.recurringDays.join(", "),
    "recurring-skip-dates": (event) => event.recurringSkipDates.join(", ")
  };
  var DOW_SHORT2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var calendar = function() {
    const wraps = [...document.querySelectorAll(WRAP2)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === LAYOUT
    );
    console.log('[calendar] DEBUG wraps with layout="calendar" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    wraps.forEach((wrap) => initCalendar(wrap));
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
    const months = attr(6, wrap.getAttribute(`data-ix-${ANIMATION_ID2}-months`));
    let range = attr("month", wrap.getAttribute(`data-ix-${ANIMATION_ID2}-range`)?.toLowerCase());
    if (range !== "month" && range !== "week") range = "month";
    const weekStartDay = attr("sunday", wrap.getAttribute(`data-ix-${ANIMATION_ID2}-week-start`)?.toLowerCase()) === "monday" ? 1 : 0;
    const dayPillLimit = attr(3, wrap.getAttribute(`data-ix-${ANIMATION_ID2}-day-pill-limit`));
    const linkFormat = attr("/event/{slug}", wrap.getAttribute(`data-ix-${ANIMATION_ID2}-link-format`));
    let overflowMode = attr("expand", wrap.getAttribute(`data-ix-${ANIMATION_ID2}-overflow-items`)?.toLowerCase());
    if (!["hide", "expand", "show"].includes(overflowMode)) overflowMode = "hide";
    const showOutsideMonthEvents = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID2}-show-outside-month`));
    const hideInactiveRow = attr(false, wrap.getAttribute(`data-ix-${ANIMATION_ID2}-hide-inactive-row`));
    const label = wrap.querySelector(LABEL2);
    const prevBtn = wrap.querySelector(PREV_BTN2);
    const nextBtn = wrap.querySelector(NEXT_BTN2);
    const todayBtn = wrap.querySelector(TODAY_BTN2);
    const weekdayLabels = [...wrap.querySelectorAll(WEEKDAY_LABEL)];
    const loadingEl = wrap.querySelector(LOADING);
    const demoNoteEl = wrap.querySelector(DEMO_NOTE);
    const hoverCardsBySlug = buildHoverCardMap(wrap);
    console.log(
      "[calendar] DEBUG hover-cards found:",
      hoverCardsBySlug.size,
      "| slugs:",
      [...hoverCardsBySlug.keys()]
    );
    if (hoverCardsBySlug.size === 0) {
      console.warn(
        `calendar: no [data-ix-events="hover-card"] elements with a resolved data-ix-events-slug were found \u2014 hover cards will never show for this instance. If you haven't yet wrapped the hover-card template in a live Webflow Collection List bound to your Events collection (see the TODO comment in the mockup), that's almost certainly why \u2014 the un-wired template only carries the literal, unresolved "{{wf:Slug}}" text.`,
        wrap
      );
    }
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
      if (prevBtn) prevBtn.classList.toggle(DISABLED_CLASS2, !canGoPrev(current));
      if (nextBtn) nextBtn.classList.toggle(DISABLED_CLASS2, !canGoNext(current));
      if (todayBtn) todayBtn.classList.toggle(DISABLED_CLASS2, isTodayActive(current));
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
    whenEvents((events) => {
      console.log("[calendar] DEBUG whenEvents callback fired, events received:", events.length, events);
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
  function buildHoverCardMap(wrap) {
    const map = /* @__PURE__ */ new Map();
    wrap.querySelectorAll(HOVER_CARD).forEach((card) => {
      unwrapFromHiddenAncestor(card, wrap);
      const slugEl = card.closest(`[${SLUG_ATTR2}]`);
      const slug = slugEl?.getAttribute(SLUG_ATTR2);
      if (slug) map.set(slug, card);
    });
    return map;
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
  function showHoverCard(card, occurrence, event, pillEl, wrap) {
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
    console.log("[calendar] DEBUG showHoverCard \u2014 event:", event.name, "| left:", left, "| top:", top, "| showBelow:", showBelow, "| parent:", parent);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.toggle("is-above", !showBelow);
    card.classList.toggle("is-below", showBelow);
    void card.offsetHeight;
    requestAnimationFrame(() => card.classList.add("is-active"));
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
            // Based on the occurrence's true start/end, not this (possibly
            // row-clipped) segment's own span — see assignLanes for why this
            // matters even for a segment that only covers one visible day.
            isMultiDay: !isSameDay(occurrence.start, occurrence.end),
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
    });
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
        const card = hoverCardsBySlug.get(seg.event.slug);
        if (!card) unmatchedSlugs.add(seg.event.slug);
        pill.addEventListener("mouseenter", () => {
          console.log("[calendar] DEBUG pill mouseenter \u2014 event:", seg.event.name, "| slug:", seg.event.slug, "| card found:", !!card);
          if (!card) return;
          if (hoverState.activeCard && hoverState.activeCard !== card) {
            hideHoverCard(hoverState.activeCard);
          }
          hoverState.activeCard = card;
          showHoverCard(card, seg.occurrence, seg.event, pill, wrap);
        });
        pill.addEventListener("mouseleave", () => {
          console.log("[calendar] DEBUG pill mouseleave \u2014 event:", seg.event.name);
          hideHoverCard(card);
          if (hoverState.activeCard === card) hoverState.activeCard = null;
        });
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
  function assignLanes(segments) {
    const byRow = /* @__PURE__ */ new Map();
    segments.forEach((seg) => {
      const row = Math.floor(seg.startIndex / 7);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push(seg);
    });
    byRow.forEach((rowSegments) => {
      rowSegments.sort(
        (a, b) => (b.isMultiDay ? 1 : 0) - (a.isMultiDay ? 1 : 0) || a.startIndex - b.startIndex || b.endIndex - b.startIndex - (a.endIndex - a.startIndex)
      );
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
    if (pos === "start" || pos === "single") {
      setDateFields(clone, occurrence, event);
      Object.entries(PILL_TEXT_FIELDS).forEach(([attrName, getValue]) => {
        setField(clone, `[data-ix-events="${attrName}"]`, getValue(event));
      });
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
  document.addEventListener("DOMContentLoaded", function() {
    eventList();
    eventFeed();
    calendar();
  });
})();
