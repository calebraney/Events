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
  var checkRunProp = function(item, animationID) {
    if (!item || !animationID) {
      console.error(`GSAP check Run Error in ${animationID}`);
      return;
    }
    const RUN = `data-ix-${animationID}-run`;
    const run = attr(true, item.getAttribute(RUN));
    if (run === false) return false;
    return true;
  };
  var getIxConfig = function(interactionID, defaults) {
    if (!interactionID) {
      console.error(`No interactionID provided to getIxConfig`);
      return;
    }
    const pageRunEl = document.querySelector(`[data-ix-${interactionID}-page-run]`);
    const pageRun = attr(true, pageRunEl?.getAttribute(`data-ix-${interactionID}-page-run`));
    if (pageRun === false) {
      document.querySelector("body").setAttribute(`data-ix-${interactionID}-page-run`, "false");
      return false;
    }
    if (typeof window.ixConfig === "undefined") return defaults;
    const siteConfig = window.ixConfig[interactionID];
    if (siteConfig === false) return false;
    if (!siteConfig || typeof siteConfig !== "object") return defaults;
    return Object.assign({}, defaults, siteConfig);
  };

  // src/interactions/recurrence.js
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

  // src/interactions/event-data.js
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
      const events = items.map((item) => {
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

  // src/interactions/event-list.js
  var ANIMATION_ID = "events";
  var LAYOUT = "list";
  var WRAP = '[data-ix-events="wrap"]';
  var PREV_BTN = '[data-ix-events="prev"]';
  var NEXT_BTN = '[data-ix-events="next"]';
  var LABEL = '[data-ix-events="label"]';
  var ITEM2 = '[data-ix-events="item"]';
  var DATA_EL2 = '[data-ix-events="data"]';
  var CARD_EL = '[data-ix-events="card"]';
  var DATE_EL = '[data-ix-events="date"]';
  var SLUG_ATTR = "data-ix-events-slug";
  var CLONE_ATTR = "data-ix-events-clone";
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
  var eventList = function() {
    const ixEnabled = getIxConfig(ANIMATION_ID, true);
    if (ixEnabled === false) return;
    const wraps = [...document.querySelectorAll(WRAP)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === LAYOUT
    );
    console.log('[event-list] DEBUG wraps with layout="list" found:', wraps.length, wraps);
    if (wraps.length === 0) return;
    whenEvents((events) => {
      console.log("[event-list] DEBUG whenEvents callback fired, events received:", events.length, events);
      const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
      const configs = wraps.map((wrap) => buildListConfig(wrap, eventsBySlug)).filter(Boolean);
      console.log("[event-list] DEBUG configs built:", configs.length, configs);
      if (configs.length === 0) return;
      window.FinsweetAttributes ||= [];
      window.FinsweetAttributes.push([
        "list",
        (listInstances) => {
          console.log("[event-list] DEBUG Finsweet list callback fired, listInstances found:", listInstances.length, listInstances);
          configs.forEach((config) => {
            const listInstance = listInstances.find((l) => l.listElement === config.list);
            console.log("[event-list] DEBUG matching Finsweet instance for config.list:", config.list, "-> found:", !!listInstance);
            if (!listInstance) {
              console.warn(
                'event-list: no Finsweet List instance found for this Collection List \u2014 add fs-list-element="list" to it.',
                config.list
              );
              return;
            }
            initList(config, listInstance);
          });
        }
      ]);
    });
  };
  function buildListConfig(wrap, eventsBySlug) {
    if (checkRunProp(wrap, ANIMATION_ID) === false) {
      console.log("[event-list] DEBUG buildListConfig: checkRunProp returned false for wrap", wrap);
      return null;
    }
    const duplicateRecurring = attr(true, wrap.getAttribute(`data-ix-${ANIMATION_ID}-duplicate-recurring`));
    const label = wrap.querySelector(LABEL);
    const prevBtn = wrap.querySelector(PREV_BTN);
    const nextBtn = wrap.querySelector(NEXT_BTN);
    console.log("[event-list] DEBUG buildListConfig: duplicateRecurring =", duplicateRecurring, "| label found:", !!label, "| prevBtn found:", !!prevBtn, "| nextBtn found:", !!nextBtn);
    const cardItems = [...wrap.querySelectorAll(ITEM2)].filter((item) => item.querySelector(CARD_EL));
    console.log("[event-list] DEBUG buildListConfig: items with a card descendant found in wrap:", cardItems.length, cardItems);
    if (cardItems.length === 0) return null;
    const entries = cardItems.map((item) => {
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
    console.log("[event-list] DEBUG buildListConfig: successfully paired entries:", entries.length, entries);
    if (entries.length === 0) return null;
    const list = entries[0].item.parentElement;
    console.log("[event-list] DEBUG buildListConfig: resolved `list` container element:", list);
    return { duplicateRecurring, label, prevBtn, nextBtn, entries, list };
  }
  function initList(config, listInstance) {
    const { duplicateRecurring, label, prevBtn, nextBtn, entries, list } = config;
    const eventByElement = new Map(entries.map(({ item, event }) => [item, event]));
    console.log("[event-list] DEBUG initList: registering hook, listInstance =", listInstance);
    const current = /* @__PURE__ */ new Date();
    current.setDate(1);
    listInstance.addHook("filter", (items) => {
      console.log("[event-list] DEBUG filter hook FIRED. items received from Finsweet:", items.length, items, "| active month:", current.getFullYear(), current.getMonth() + 1);
      const removedClones = list.querySelectorAll(`[${CLONE_ATTR}]`);
      console.log("[event-list] DEBUG removing stale clones from previous pass:", removedClones.length);
      removedClones.forEach((el) => el.remove());
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
      const result = [];
      items.forEach((listItem) => {
        const event = eventByElement.get(listItem.element);
        if (!event) {
          console.log("[event-list] DEBUG no matching event for this listItem.element (stale/unrecognized) \u2014 dropping:", listItem.element);
          return;
        }
        const occurrences = getOccurrences(event, monthStart, monthEnd).sort((a, b) => a.start - b.start);
        console.log("[event-list] DEBUG event", event.name, "-> occurrences this month:", occurrences.length);
        if (occurrences.length === 0) return;
        const [first, ...rest] = occurrences;
        setDateFields(listItem.element, first, event);
        result.push({ listItem, date: first.start, showStartTime: event.showStartTime });
        if (duplicateRecurring) {
          let insertAfter = listItem.element;
          rest.forEach((occ, i) => {
            const clone = listItem.element.cloneNode(true);
            clone.setAttribute(CLONE_ATTR, "");
            uniquifyIds(clone, `occ-${i + 1}`);
            setDateFields(clone, occ, event);
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
      console.log("[event-list] DEBUG refresh() called \u2014 month now:", current.getFullYear(), current.getMonth() + 1);
      if (label) {
        label.textContent = current.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
      listInstance.triggerHook("filter");
    };
    refresh();
    prevBtn?.addEventListener("click", () => {
      current.setMonth(current.getMonth() - 1);
      refresh();
    });
    nextBtn?.addEventListener("click", () => {
      current.setMonth(current.getMonth() + 1);
      refresh();
    });
  }
  function compareListEntries(a, b) {
    const dayDiff = startOfDay2(a.date) - startOfDay2(b.date);
    if (dayDiff !== 0) return dayDiff;
    if (a.showStartTime !== b.showStartTime) return a.showStartTime ? -1 : 1;
    return a.date - b.date;
  }
  function startOfDay2(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
  function setDateFields(root, occurrence, event) {
    root.querySelectorAll(DATE_EL).forEach((el) => {
      const format = el.getAttribute("data-ix-events-date-format") || "MMMM D, YYYY";
      el.textContent = isFullDateFormat(format) ? formatFullDate(occurrence, event) : formatOccurrenceDate(occurrence.start, format);
    });
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
    const startPeriod = start.getHours() >= 12 ? "pm" : "am";
    const endPeriod = end.getHours() >= 12 ? "pm" : "am";
    const start12Hour = start.getHours() % 12 || 12;
    const hideStartPeriod = startPeriod === endPeriod && start12Hour !== 12;
    const startTimeText = hideStartPeriod ? startTime.slice(0, -2) : startTime;
    return `${datePart}, ${startTimeText}-${endTime}`;
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

  // src/interactions/calendar.js
  var ANIMATION_ID2 = "events";
  var LAYOUT2 = "calendar";
  var WRAP2 = '[data-ix-events="wrap"]';
  var MONTH_FULL2 = [
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
  var DOW_SHORT2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var EVENT_COLOR_VARS = [
    ["--_theme---text--text-accent", "#2563eb"],
    ["--_theme---border--border-secondary", "#6b7280"],
    ["--_theme---text--text-primary", "#1f2937"]
  ];
  var stylesInjected = false;
  var calendar = function() {
    const ixEnabled = getIxConfig(ANIMATION_ID2, true);
    if (ixEnabled === false) return;
    const wraps = [...document.querySelectorAll(WRAP2)].filter(
      (wrap) => wrap.getAttribute("data-ix-events-layout") === LAYOUT2
    );
    if (wraps.length === 0) return;
    injectStyles();
    wraps.forEach((wrap) => {
      if (checkRunProp(wrap, ANIMATION_ID2) === false) return;
      initCalendar(wrap);
    });
  };
  function initCalendar(wrap) {
    const monthRange = attr(6, wrap.getAttribute(`data-ix-${ANIMATION_ID2}-months`));
    const today = /* @__PURE__ */ new Date();
    const state = { year: today.getFullYear(), month: today.getMonth(), events: [], loading: true };
    wrap.classList.add("ix-calendar");
    wrap.style.position = "relative";
    wrap.innerHTML = "";
    const header = buildHeader();
    const grid = buildGrid();
    const loadingEl = buildLoadingOverlay();
    const tooltip = buildTooltip();
    wrap.append(header.el, grid.weekdayRow, grid.gridEl, loadingEl, tooltip.el);
    const minMonth = new Date(today.getFullYear(), today.getMonth() - monthRange, 1);
    const maxMonth = new Date(today.getFullYear(), today.getMonth() + monthRange, 1);
    const canGoPrev = () => new Date(state.year, state.month - 1, 1) >= minMonth;
    const canGoNext = () => new Date(state.year, state.month + 1, 1) <= maxMonth;
    header.prevBtn.addEventListener("click", () => {
      if (!canGoPrev()) return;
      shiftMonth(-1);
      render();
    });
    header.nextBtn.addEventListener("click", () => {
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
      header.label.textContent = `${MONTH_FULL2[state.month]} ${state.year}`;
      header.prevBtn.disabled = !canGoPrev();
      header.nextBtn.disabled = !canGoNext();
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
    render();
    whenEvents((events) => {
      const usedDemo = events.length === 0;
      state.events = usedDemo ? demoEvents() : events;
      state.loading = false;
      loadingEl.style.display = "none";
      if (usedDemo) {
        const note = document.createElement("p");
        note.className = "ix-calendar_demo-note";
        note.textContent = "No events data-wrap found on this page \u2014 showing sample data.";
        wrap.append(note);
      }
      render();
    });
  }
  function buildHeader() {
    const el = document.createElement("div");
    el.className = "ix-calendar_header";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "ix-calendar_nav-btn";
    prevBtn.setAttribute("aria-label", "Previous month");
    prevBtn.innerHTML = arrowSvg("M15 18l-6-6 6-6");
    const label = document.createElement("h2");
    label.className = "ix-calendar_label";
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "ix-calendar_nav-btn";
    nextBtn.setAttribute("aria-label", "Next month");
    nextBtn.innerHTML = arrowSvg("M9 18l6-6-6-6");
    el.append(prevBtn, label, nextBtn);
    return { el, prevBtn, label, nextBtn };
  }
  function arrowSvg(path) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  }
  function buildGrid() {
    const weekdayRow = document.createElement("div");
    weekdayRow.className = "ix-calendar_weekdays";
    DOW_SHORT2.forEach((d) => {
      const cell = document.createElement("div");
      cell.className = "ix-calendar_weekday";
      cell.textContent = d;
      weekdayRow.append(cell);
    });
    const gridEl = document.createElement("div");
    gridEl.className = "ix-calendar_grid";
    return { weekdayRow, gridEl };
  }
  function buildLoadingOverlay() {
    const el = document.createElement("div");
    el.className = "ix-calendar_loading";
    el.textContent = "Loading events\u2026";
    return el;
  }
  function buildTooltip() {
    const el = document.createElement("div");
    el.className = "ix-calendar_tooltip";
    el.style.display = "none";
    return { el };
  }
  function renderGrid(grid, year, month, occurrences, today, tooltip, wrap) {
    grid.gridEl.innerHTML = "";
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInThisMonth = daysInMonth2(year, month);
    const prevMonthDays = daysInMonth2(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
    const cells = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({
        date: new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d),
        inMonth: false
      });
    }
    for (let d = 1; d <= daysInThisMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: addDays2(last, 1), inMonth: false });
    }
    cells.forEach((cell, i) => {
      const dayEl = document.createElement("div");
      dayEl.className = "ix-calendar_day";
      if (!cell.inMonth) dayEl.classList.add("is-outside");
      if ((i + 1) % 7 === 0) dayEl.classList.add("is-last-col");
      const isToday = cell.inMonth && isSameDay(cell.date, today);
      const numberEl = document.createElement("div");
      numberEl.className = "ix-calendar_day-number-row";
      const numberBadge = document.createElement("span");
      numberBadge.className = "ix-calendar_day-number" + (isToday ? " is-today" : "");
      numberBadge.textContent = String(cell.date.getDate());
      numberEl.append(numberBadge);
      dayEl.append(numberEl);
      if (cell.inMonth) {
        const dayOccurrences = occurrences.filter((o) => dayInRange(cell.date, o.start, o.end));
        const eventsEl = document.createElement("div");
        eventsEl.className = "ix-calendar_day-events";
        dayOccurrences.slice(0, 2).forEach((occ) => {
          eventsEl.append(buildEventPill(occ, cell.date, occurrences, tooltip, wrap));
        });
        if (dayOccurrences.length > 2) {
          const more = document.createElement("span");
          more.className = "ix-calendar_more";
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
    const pos = isStart && isEnd ? "single" : isStart ? "start" : isEnd ? "end" : "middle";
    const color = EVENT_COLOR_VARS[simpleHash(occ.event.id) % EVENT_COLOR_VARS.length];
    const pill = document.createElement("a");
    pill.className = `ix-calendar_pill is-${pos}`;
    pill.href = `/event/${occ.event.slug}`;
    pill.style.setProperty("--pill-color", `var(${color[0]}, ${color[1]})`);
    pill.textContent = pos === "single" || pos === "start" ? occ.event.name : "\xA0";
    pill.addEventListener("mouseenter", () => showTooltip(tooltip, occ, pill, wrap));
    pill.addEventListener("mouseleave", () => hideTooltip(tooltip));
    return pill;
  }
  function showTooltip(tooltip, occ, targetEl, wrap) {
    const { event, start, end } = occ;
    const wrapRect = wrap.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    let dateText = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!isSameDay(start, end))
      dateText += ` \u2013 ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    if (event.showStartTime) dateText += ` \xB7 ${formatTime(start)}`;
    if (event.showEndTime && !isSameDay(start, end)) dateText += ` \u2013 ${formatTime(end)}`;
    else if (event.showEndTime && event.showStartTime && end.getTime() !== start.getTime())
      dateText += ` \u2013 ${formatTime(end)}`;
    tooltip.el.innerHTML = `
    <h3 class="ix-calendar_tooltip-title">${escapeHtml(event.name)}</h3>
    <div class="ix-calendar_tooltip-meta">${escapeHtml(dateText)}</div>
    ${event.location ? `<div class="ix-calendar_tooltip-meta">${escapeHtml(event.location)}</div>` : ""}
    ${event.shortDescription ? `<p class="ix-calendar_tooltip-desc">${escapeHtml(event.shortDescription)}</p>` : ""}
  `;
    const tooltipWidth = 256;
    const rawX = targetRect.left - wrapRect.left + targetRect.width / 2;
    const clampedX = Math.max(tooltipWidth / 2, Math.min(rawX, wrapRect.width - tooltipWidth / 2));
    tooltip.el.style.left = `${clampedX}px`;
    tooltip.el.style.top = `${targetRect.top - wrapRect.top}px`;
    tooltip.el.style.display = "block";
  }
  function hideTooltip(tooltip) {
    tooltip.el.style.display = "none";
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
        shortDescription: "Join us for our monthly community gathering.",
        location: "Community Center",
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
        shortDescription: "A full week of volunteer opportunities.",
        location: "Various Locations",
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
        shortDescription: "Biweekly small group discussion.",
        location: "Room 204",
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
  function addDays2(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }
  function startOfDay3(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayInRange(day, start, end) {
    const d = startOfDay3(day);
    return d >= startOfDay3(start) && d <= startOfDay3(end);
  }
  function formatTime(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = hash * 31 + str.charCodeAt(i) >>> 0;
    return hash;
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
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

  // src/index.js
  document.addEventListener("DOMContentLoaded", function() {
    eventList();
    calendar();
  });
})();
