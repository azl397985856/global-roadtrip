/* 环球自驾六年计划 —— 交互逻辑 */
(function () {
  "use strict";

  var SHORT = {
    l1: "滇南", hainan: "海南", l2: "川西", l3: "新疆", xibei: "青甘", dongbei: "东北",
    l4: "新西兰", l5: "美西",
    l6: "挪威", l7: "冰岛", l8: "澳洲", l9: "南非", l10: "南美", l11: "落基山",
  };
  var DIFF_LABEL = { 1: "轻松", 2: "舒适", 3: "适中", 4: "挑战", 5: "远征" };

  var stageById = {};
  PLAN.stages.forEach(function (s) { stageById[s.id] = s; });
  PLAN.legs.forEach(function (l) {
    l.stageObj = stageById[l.stage];
    l.short = SHORT[l.id] || l.name;
  });

  /* ---------- 本地存储 ---------- */
  function loadJSON(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  var status = loadJSON("grp_status", {});   // { legId: "done" | "want" }
  var prepDone = loadJSON("grp_prep", []);   // [itemId, ...]

  function stars(n) {
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
    return s;
  }
  function yearOf(leg) {
    var m = leg.dates.match(/\d{4}/);
    return m ? m[0] : "—";
  }

  /* ---------- Hero ---------- */
  var elSub = document.getElementById("heroSub");
  if (elSub) elSub.textContent = PLAN.meta.subtitle;

  var totalDays = 0, totalKm = 0;
  var countrySet = {};
  PLAN.legs.forEach(function (l) {
    totalDays += l.days;
    var n = parseInt(l.km.replace(/[^0-9]/g, ""), 10);
    if (n) totalKm += n;
    (l.countries || []).forEach(function (c) { countrySet[c] = 1; });
  });
  var kmText = totalKm >= 10000 ? (totalKm / 10000).toFixed(1) + " 万 km" : totalKm.toLocaleString() + " km";
  var statData = [
    [PLAN.legs.length, "段旅程"],
    [totalDays + " 天", "在路上"],
    [kmText, "自驾总里程"],
    [Object.keys(countrySet).length + " 国", "覆盖国家"],
    [PLAN.meta.continents + " 大洲", "除南极外全部"],
  ];
  document.getElementById("heroStats").innerHTML = statData.map(function (d) {
    return '<div class="stat"><b>' + d[0] + '</b><span>' + d[1] + "</span></div>";
  }).join("");

  function renderProgress() {
    var done = 0, want = 0;
    PLAN.legs.forEach(function (l) {
      if (status[l.id] === "done") done++;
      else if (status[l.id] === "want") want++;
    });
    var total = PLAN.legs.length;
    document.getElementById("progressText").textContent =
      done + " / " + total + " 段" + (want ? " · 另有 " + want + " 段在愿望单" : "");
    document.getElementById("progressFill").style.width = (done / total * 100) + "%";
  }

  /* ---------- 地图 ---------- */
  var map = L.map("mapBox", { worldCopyJump: true, minZoom: 2, maxZoom: 10 }).setView([22, 60], 2);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  var legLayers = {}; // legId -> L.LayerGroup
  PLAN.legs.forEach(function (leg) {
    var color = leg.stageObj.color;
    var group = L.layerGroup();
    (leg.route || []).forEach(function (line) {
      if (!line || !line.length) return;
      if (line.length === 1) {
        // 飞行接驳的单点锚（如特罗姆瑟、克鲁格）
        L.circleMarker(line[0], { radius: 5, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.95 })
          .on("click", function () { openLeg(leg.id); }).addTo(group);
        return;
      }
      L.polyline(line, { color: color, weight: 4, opacity: 0.85 }).on("click", function () {
        openLeg(leg.id);
      }).addTo(group);
    });
    var start = leg.route[0][0];
    L.marker(start, {
      icon: L.divIcon({ className: "", html: '<div class="leg-dot" style="background:' + color + '">' + leg.no + "</div>", iconSize: [26, 26], iconAnchor: [13, 13] }),
    }).on("click", function () { openLeg(leg.id); }).addTo(group);
    legLayers[leg.id] = group;
    group.addTo(map);
  });

  var filterWrap = document.getElementById("stageFilter");
  function setFilter(stageId) {
    PLAN.legs.forEach(function (leg) {
      var on = stageId === "all" || leg.stage === stageId;
      if (on) legLayers[leg.id].addTo(map);
      else map.removeLayer(legLayers[leg.id]);
    });
    var bounds = [];
    PLAN.legs.forEach(function (leg) {
      if (stageId === "all" || leg.stage === stageId) {
        (leg.route || []).forEach(function (line) { bounds = bounds.concat(line); });
      }
    });
    if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.25));
  }
  function renderFilter(active) {
    var btns = [{ id: "all", name: "全部 " + PLAN.legs.length + " 段", color: "#12213f" }].concat(
      PLAN.stages.map(function (s) { return { id: s.id, name: s.name + " · " + s.period, color: s.color }; })
    );
    filterWrap.innerHTML = "";
    btns.forEach(function (b) {
      var el = document.createElement("button");
      el.className = "filter-btn" + (b.id === active ? " active" : "");
      if (b.id === active) el.style.background = b.color;
      el.textContent = b.name;
      el.onclick = function () {
        renderFilter(b.id);
        setFilter(b.id);
      };
      filterWrap.appendChild(el);
    });
  }
  renderFilter("all");

  /* ---------- 时间线 ---------- */
  function legCardHTML(leg) {
    var st = status[leg.id];
    return (
      '<div class="leg-card' + (st === "done" ? " done" : "") + '" style="--c:' + leg.stageObj.color + '" data-leg="' + leg.id + '">' +
      '<div class="leg-card-head">' +
      '<div class="leg-no">' + leg.no + "</div>" +
      '<div class="leg-title">' + leg.flag + " " + leg.name + "</div>" +
      '<div class="leg-region">' + leg.region + "</div>" +
      "</div>" +
      '<div class="leg-meta">' +
      '<span class="chip">📅 ' + leg.dates + "</span>" +
      '<span class="chip">' + leg.days + " 天</span>" +
      '<span class="chip">' + leg.km + "</span>" +
      '<span class="chip">' + stars(leg.diff) + " " + DIFF_LABEL[leg.diff] + "</span>" +
      "</div>" +
      '<div class="leg-highlight">✨ ' + leg.highlights.slice(0, 2).join(" · ") + "</div>" +
      '<div class="leg-card-foot">' +
      '<span class="leg-link">查看逐日行程 →</span>' +
      '<div class="status-btns">' +
      '<button class="mini-btn plan' + (st === "want" ? " on" : "") + '" data-act="want" data-leg="' + leg.id + '">想去</button>' +
      '<button class="mini-btn go' + (st === "done" ? " on" : "") + '" data-act="done" data-leg="' + leg.id + '">完成 ✓</button>' +
      "</div></div></div>"
    );
  }

  var timelineWrap = document.getElementById("timelineWrap");
  var html = "";
  var years = [];
  PLAN.legs.forEach(function (leg) {
    var y = yearOf(leg);
    if (years.indexOf(y) === -1) years.push(y);
  });
  years.forEach(function (y) {
    var legsInYear = PLAN.legs.filter(function (l) { return yearOf(l) === y; });
    var stageNames = [];
    legsInYear.forEach(function (l) {
      var n = l.stageObj.name;
      if (stageNames.indexOf(n) === -1) stageNames.push(n);
    });
    html += '<div class="year-group"><div class="year-label"><b>' + y + "</b><span>" + stageNames.join(" / ") + "</span></div>";
    html += '<div class="leg-grid">' + legsInYear.map(legCardHTML).join("") + "</div></div>";
  });
  timelineWrap.innerHTML = html;

  var extrasBox = document.getElementById("extrasBox");
  extrasBox.innerHTML =
    "<h3>🧩 加餐备选（任意年份插入）</h3>" +
    "<h3 style='font-size:14px;color:var(--ink-3)'>国内</h3><ul>" +
    PLAN.extras.domestic.map(function (x) { return "<li>" + x + "</li>"; }).join("") +
    "</ul><h3 style='font-size:14px;color:var(--ink-3)'>境外</h3><ul>" +
    PLAN.extras.overseas.map(function (x) { return "<li>" + x + "</li>"; }).join("") +
    "</ul>";

  timelineWrap.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".mini-btn");
    if (btn) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-leg"), act = btn.getAttribute("data-act");
      status[id] = status[id] === act ? "" : act;
      saveJSON("grp_status", status);
      rebuildTimeline();
      renderProgress();
      return;
    }
    var card = ev.target.closest(".leg-card");
    if (card) openLeg(card.getAttribute("data-leg"));
  });

  function rebuildTimeline() {
    var h = "";
    years.forEach(function (y) {
      var legsInYear = PLAN.legs.filter(function (l) { return yearOf(l) === y; });
      var stageNames = [];
      legsInYear.forEach(function (l) {
        var n = l.stageObj.name;
        if (stageNames.indexOf(n) === -1) stageNames.push(n);
      });
      h += '<div class="year-group"><div class="year-label"><b>' + y + "</b><span>" + stageNames.join(" / ") + "</span></div>";
      h += '<div class="leg-grid">' + legsInYear.map(legCardHTML).join("") + "</div></div>";
    });
    timelineWrap.innerHTML = h;
  }

  /* ---------- 难度曲线 ---------- */
  (function renderChart() {
    var W = 1000, H = 300, padL = 56, padR = 20, padT = 26, padB = 64;
    var n = PLAN.legs.length;
    var x = function (i) { return padL + (W - padL - padR) * (i / (n - 1)); };
    var y = function (v) { return padT + (H - padT - padB) * (1 - (v - 1) / 4); };
    var pts = PLAN.legs.map(function (l, i) { return { x: x(i), y: y(l.diff), leg: l }; });
    var path = pts.map(function (p, i) { return (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
    var area = path + " L" + pts[n - 1].x + "," + (H - padB) + " L" + pts[0].x + "," + (H - padB) + " Z";

    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="难度曲线图">';
    svg += '<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#f5b942" stop-opacity="0.28"/><stop offset="100%" stop-color="#f5b942" stop-opacity="0.02"/>' +
      "</linearGradient></defs>";
    for (var v = 1; v <= 5; v++) {
      svg += '<line x1="' + padL + '" y1="' + y(v) + '" x2="' + (W - padR) + '" y2="' + y(v) + '" stroke="#e9edf5" stroke-width="1"/>';
      svg += '<text x="' + (padL - 10) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="12" fill="#8a93aa">' + v + " " + DIFF_LABEL[v] + "</text>";
    }
    svg += '<path d="' + area + '" fill="url(#gArea)"/>';
    svg += '<path d="' + path + '" fill="none" stroke="#f5b942" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(function (p) {
      svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="7" fill="' + p.leg.stageObj.color + '" stroke="#fff" stroke-width="2.5"><title>' +
        p.leg.no + ". " + p.leg.name + " · 难度 " + p.leg.diff + "</title></circle>";
      svg += '<text x="' + p.x + '" y="' + (p.y - 14) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#55607a">' + p.leg.short + "</text>";
      svg += '<text x="' + p.x + '" y="' + (H - padB + 22) + '" text-anchor="middle" font-size="11" fill="#8a93aa">' + yearOf(p.leg) + "</text>";
    });
    svg += "</svg>";
    document.getElementById("chartBox").innerHTML = svg;
    document.getElementById("chartLegend").innerHTML = PLAN.stages.map(function (s) {
      return '<span class="lg"><span class="dot" style="background:' + s.color + '"></span>' + s.name + "（" + s.period + "）</span>";
    }).join("");
  })();

  /* ---------- 策略卡 ---------- */
  document.getElementById("strategyGrid").innerHTML = STRATEGY.map(function (c) {
    return (
      '<div class="strategy-card"><h3><span>' + c.icon + "</span>" + c.title + "</h3><ul>" +
      c.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") +
      "</ul></div>"
    );
  }).join("");

  /* ---------- 准备清单 ---------- */
  var prepWrap = document.getElementById("prepWrap");
  function renderPrep() {
    prepWrap.innerHTML = PREP.map(function (g) {
      return (
        '<div class="prep-card"><h3><span>' + g.icon + "</span>" + g.group + "</h3>" +
        g.items.map(function (it) {
          var checked = prepDone.indexOf(it.id) !== -1 ? " checked" : "";
          return '<div class="prep-item"><input type="checkbox" id="' + it.id + '"' + checked + '><label for="' + it.id + '">' + it.text + "</label></div>";
        }).join("") +
        "</div>"
      );
    }).join("");
    var all = 0, done = 0;
    PREP.forEach(function (g) { g.items.forEach(function (it) { all++; if (prepDone.indexOf(it.id) !== -1) done++; }); });
    document.getElementById("prepText").textContent = done + " / " + all + " 项已完成";
  }
  renderPrep();
  prepWrap.addEventListener("change", function (ev) {
    var cb = ev.target;
    if (cb.tagName !== "INPUT") return;
    var idx = prepDone.indexOf(cb.id);
    if (cb.checked && idx === -1) prepDone.push(cb.id);
    if (!cb.checked && idx !== -1) prepDone.splice(idx, 1);
    saveJSON("grp_prep", prepDone);
    renderPrep();
  });

  /* ---------- 行程详情 Modal ---------- */
  var overlay = document.getElementById("modalOverlay");
  var modalBody = document.getElementById("modalBody");

  function openLeg(id) {
    var leg = null;
    PLAN.legs.forEach(function (l) { if (l.id === id) leg = l; });
    if (!leg) return;
    var stopChips = leg.stops.map(function (s, i) {
      return (i ? '<span class="sep">→</span>' : "") + '<span class="chip">' + s + "</span>";
    }).join("");
    var st = status[leg.id];
    modalBody.innerHTML =
      '<div class="m-head"><div class="leg-no" style="background:' + leg.stageObj.color + '">' + leg.no + "</div><h2>" +
      leg.flag + " " + leg.name + "</h2></div>" +
      '<div class="m-region">' + leg.region + " · " + leg.stageObj.name + "（" + leg.stageObj.period + "）</div>" +
      '<p class="m-intro">' + leg.intro + "</p>" +
      '<div class="m-stats">' +
      '<div class="m-stat"><b>📅 ' + leg.dates + "</b><span>出行窗口</span></div>" +
      '<div class="m-stat"><b>' + leg.days + " 天</b><span>行程时长</span></div>" +
      '<div class="m-stat"><b>' + leg.km + "</b><span>自驾里程</span></div>" +
      '<div class="m-stat"><b>' + stars(leg.diff) + "</b><span>难度 · " + DIFF_LABEL[leg.diff] + "</span></div>" +
      '<div class="m-stat"><b>' + leg.season + "</b><span>当时气候</span></div>" +
      '<div class="m-stat"><b>' + leg.budget + "</b><span>参考预算</span></div>" +
      "</div>" +
      '<div class="m-sub">路线</div><div class="route-chips">' + stopChips + "</div>" +
      '<div class="m-sub">不可错过</div><div class="hl-grid">' +
      leg.highlights.map(function (h) { return '<div class="hl-item">✨ ' + h + "</div>"; }).join("") +
      "</div>" +
      '<div class="m-sub">逐日行程（' + leg.drive + "）</div>" +
      '<table class="m-table"><thead><tr><th>日</th><th>行程</th><th>驾驶</th><th>玩什么</th><th>宿</th></tr></thead><tbody>' +
      leg.itinerary.map(function (r) {
        return "<tr><td class='d-col'>" + r.d + "</td><td>" + r.route + '</td><td class="drive-col">' + r.drive + "</td><td>" + r.desc + '</td><td class="stay-col">' + r.stay + "</td></tr>";
      }).join("") +
      "</tbody></table>" +
      '<div class="m-sub">关键提示</div><ul class="tips-list">' +
      leg.tips.map(function (t) { return "<li>" + t + "</li>"; }).join("") +
      "</ul>" +
      '<div style="margin-top:22px;text-align:right">' +
      '<button class="mini-btn' + (st === "want" ? " on" : "") + '" data-act="want" data-leg="' + leg.id + '" style="--c:#3b6ef5">想去</button> ' +
      '<button class="mini-btn' + (st === "done" ? " on" : "") + '" data-act="done" data-leg="' + leg.id + '" style="--c:#10b981">完成 ✓</button>' +
      "</div>";

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.scrollTop = 0;
  }

  modalBody.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".mini-btn");
    if (!btn) return;
    var id = btn.getAttribute("data-leg"), act = btn.getAttribute("data-act");
    status[id] = status[id] === act ? "" : act;
    saveJSON("grp_status", status);
    rebuildTimeline();
    renderProgress();
    openLeg(id);
  });

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
  }
  document.getElementById("modalClose").onclick = closeModal;
  overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeModal(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !overlay.hidden) closeModal(); });

  /* ---------- 页脚链接 ---------- */
  var repoLink = document.getElementById("repoLink");
  if (repoLink) repoLink.href = PLAN.meta.repo;
  var pagesA = document.createElement("a");
  pagesA.href = PLAN.meta.pages;
  pagesA.target = "_blank";
  pagesA.rel = "noopener";
  pagesA.textContent = " 在线访问";
  var muted = document.querySelector("footer .muted");
  if (muted) {
    muted.appendChild(document.createTextNode(" ·"));
    muted.appendChild(pagesA);
  }

  renderProgress();
})();
