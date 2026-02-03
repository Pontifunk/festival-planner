// ====== DEBUG CLS ======
function initClsDebug() {
  var flag = null;
  if (typeof getQueryParam === "function") flag = getQueryParam("debug");
  if (flag !== "cls") return;

  if (typeof PerformanceObserver === "undefined") {
    console.warn("[CLS] PerformanceObserver not supported.");
    return;
  }

  var total = 0;
  var count = 0;
  var bySelector = new Map();

  var round = function (n) {
    return Math.round(Number(n) || 0);
  };

  var formatRect = function (rect) {
    if (!rect) return "n/a";
    return round(rect.x) + "," + round(rect.y) + " " + round(rect.width) + "x" + round(rect.height);
  };

  var nodeSelector = function (node) {
    if (!node || node.nodeType !== 1) return "<non-element>";
    var tag = String(node.tagName || "").toLowerCase() || "unknown";
    var id = node.id ? "#" + node.id : "";
    var cls = "";
    if (node.classList && node.classList.length) {
      var list = [];
      node.classList.forEach(function (c) {
        if (list.length < 3) list.push(c);
      });
      if (list.length) cls = "." + list.join(".");
    }
    return tag + id + cls;
  };

  var record = function (selector, value, time) {
    var data = bySelector.get(selector);
    if (!data) data = { score: 0, count: 0, lastTime: 0 };
    data.score += value;
    data.count += 1;
    data.lastTime = time;
    bySelector.set(selector, data);
  };

  var logShift = function (entry) {
    var time = round(entry.startTime);
    total += entry.value;
    count += 1;

    var sources = entry.sources || [];
    var rows = [];
    if (sources.length) {
      sources.forEach(function (source) {
        var selector = nodeSelector(source.node);
        rows.push({
          selector: selector,
          value: entry.value.toFixed(4),
          prev: formatRect(source.previousRect),
          curr: formatRect(source.currentRect)
        });
        record(selector, entry.value, time);
      });
    } else {
      record("<unknown>", entry.value, time);
    }

    var label = "[CLS] +" + entry.value.toFixed(4) + " @ " + time + "ms (total " + total.toFixed(4) + ")";
    if (rows.length && console.groupCollapsed) {
      console.groupCollapsed(label);
      if (console.table) console.table(rows);
      console.groupEnd();
    } else {
      console.log(label);
    }
  };

  var logSummary = function () {
    var top = Array.from(bySelector.entries()).map(function (item) {
      return {
        selector: item[0],
        score: Number(item[1].score.toFixed(4)),
        shifts: item[1].count,
        lastMs: item[1].lastTime
      };
    }).sort(function (a, b) {
      return b.score - a.score;
    }).slice(0, 8);

    console.log("[CLS] total", total.toFixed(4), "from", count, "shift(s)");
    if (top.length && console.table) console.table(top);
  };

  var observer = new PerformanceObserver(function (list) {
    list.getEntries().forEach(function (entry) {
      if (entry.hadRecentInput) return;
      if (!entry.value) return;
      logShift(entry);
    });
  });

  try {
    observer.observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    console.warn("[CLS] layout-shift observer failed.");
    return;
  }

  window.addEventListener("pagehide", logSummary);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") logSummary();
  });

  console.info("[CLS] Debug logging enabled (?debug=cls)");
}
