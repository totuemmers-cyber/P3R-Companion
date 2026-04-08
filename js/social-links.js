// P3R Companion — Social Links Logic & Rendering

// ========== STATE & PERSISTENCE ==========
const SL_STORAGE_KEY = 'p3r-social-links';
const SL_ARCANA_ORDER = ["Fool","Magician","Priestess","Empress","Emperor","Hierophant",
  "Lovers","Chariot","Justice","Hermit","Fortune","Strength","Hanged","Death",
  "Temperance","Devil","Tower","Star","Moon","Sun","Judgement","Aeon"];

let slState = null;

function slDefaultState() {
  const ranks = {};
  SL_ARCANA_ORDER.forEach(function(a) { ranks[a] = 0; });
  return {
    gameDate: { month: 4, day: 7 },
    stats: { academics: 1, charm: 1, courage: 1 },
    ranks: ranks
  };
}

function slLoad() {
  try {
    const raw = localStorage.getItem(SL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const def = slDefaultState();
      // Merge in case new arcana were added
      SL_ARCANA_ORDER.forEach(function(a) {
        if (parsed.ranks[a] === undefined) parsed.ranks[a] = 0;
      });
      return parsed;
    }
  } catch(e) { /* ignore */ }
  return slDefaultState();
}

function slSave() {
  localStorage.setItem(SL_STORAGE_KEY, JSON.stringify(slState));
}

// ========== DATE UTILITIES ==========
// P3R uses 2009 (Apr-Dec) and 2010 (Jan) calendars
function slGetDayOfWeek(month, day) {
  var year = month >= 2 ? 2009 : 2010;
  return new Date(year, month - 1, day).getDay();
}

function slDateToNum(d) {
  // Convert {month,day} to a sortable number. Apr=4 is start.
  // Map: Apr(4)=4, May(5)=5, ..., Dec(12)=12, Jan(1)=13
  var m = d.month >= 4 ? d.month : d.month + 12;
  return m * 100 + d.day;
}

function slCompareDates(a, b) {
  return slDateToNum(a) - slDateToNum(b);
}

function slFormatDate(d) {
  return MONTH_NAMES[d.month] + ' ' + d.day;
}

function slDaysBetween(a, b) {
  var ya = a.month >= 4 ? 2009 : 2010;
  var yb = b.month >= 4 ? 2009 : 2010;
  var da = new Date(ya, a.month - 1, a.day);
  var db = new Date(yb, b.month - 1, b.day);
  return Math.round((db - da) / 86400000);
}

function slAdvanceDate(d, days) {
  var y = d.month >= 4 ? 2009 : 2010;
  var dt = new Date(y, d.month - 1, d.day);
  dt.setDate(dt.getDate() + days);
  var m = dt.getMonth() + 1;
  return { month: m, day: dt.getDate() };
}

function slGetMonday(d) {
  // Get the Monday of the week containing date d
  var y = d.month >= 4 ? 2009 : 2010;
  var dt = new Date(y, d.month - 1, d.day);
  var dow = dt.getDay();
  var diff = dow === 0 ? -6 : 1 - dow; // Monday = 1
  dt.setDate(dt.getDate() + diff);
  return { month: dt.getMonth() + 1, day: dt.getDate() };
}

// ========== AVAILABILITY ENGINE ==========
function slIsUnlocked(arcana) {
  var link = SOCIAL_LINKS[arcana];
  if (!link) return false;
  return slCompareDates(slState.gameDate, link.unlockDate) >= 0;
}

function slIsExpired(arcana) {
  var link = SOCIAL_LINKS[arcana];
  if (!link || !link.endDate) return false;
  return slCompareDates(slState.gameDate, link.endDate) > 0;
}

function slStatsMet(arcana) {
  var link = SOCIAL_LINKS[arcana];
  if (!link) return false;
  for (var stat in link.statRequirements) {
    if ((slState.stats[stat] || 1) < link.statRequirements[stat]) return false;
  }
  return true;
}

function slGetBlockedReason(month, day, timeSlot) {
  var dn = slDateToNum({month: month, day: day});
  for (var i = 0; i < BLOCKED_DATES.length; i++) {
    var b = BLOCKED_DATES[i];
    if (dn >= slDateToNum(b.from) && dn <= slDateToNum(b.to)) {
      if (b.block === 'both' || b.block === timeSlot) return b.reason;
    }
  }
  return null;
}

function slGetAvailableLinks(date, timeSlot) {
  var dow = slGetDayOfWeek(date.month, date.day);
  var results = [];
  SL_ARCANA_ORDER.forEach(function(arcana) {
    var link = SOCIAL_LINKS[arcana];
    if (!link || link.automatic) return;
    if (slCompareDates(date, link.unlockDate) < 0) return;
    if (link.endDate && slCompareDates(date, link.endDate) > 0) return;
    if (timeSlot && link.timeSlot !== timeSlot) return;
    if (link.availableDays.indexOf(dow) === -1) return;
    if (slState.ranks[arcana] >= 10) return;
    var blocked = slGetBlockedReason(date.month, date.day, link.timeSlot);
    results.push({
      arcana: arcana,
      link: link,
      rank: slState.ranks[arcana] || 0,
      statsMet: slStatsMet(arcana),
      blocked: blocked
    });
  });
  return results;
}

// ========== RECOMMENDATION ENGINE ==========
function slCountFusionPairs(arcana) {
  if (typeof ARCANA_CHART === 'undefined') return 0;
  var count = 0;
  for (var a1 in ARCANA_CHART) {
    for (var a2 in ARCANA_CHART[a1]) {
      if (ARCANA_CHART[a1][a2] === arcana) count++;
    }
  }
  // Chart is symmetric so each pair counted twice, except same-arcana
  return Math.ceil(count / 2);
}

function slCountPersonas(arcana) {
  if (typeof PERSONAS === 'undefined') return 0;
  var count = 0;
  for (var name in PERSONAS) {
    if (PERSONAS[name].race === arcana) count++;
  }
  return count;
}

// Cache fusion data (computed once)
var slFusionCache = null;
function slGetFusionData(arcana) {
  if (!slFusionCache) {
    slFusionCache = {};
    SL_ARCANA_ORDER.forEach(function(a) {
      slFusionCache[a] = {
        pairs: slCountFusionPairs(a),
        personas: slCountPersonas(a)
      };
    });
  }
  return slFusionCache[arcana] || { pairs: 0, personas: 0 };
}

function slGetRosterMatchForArcana(arcana) {
  if (typeof roster === 'undefined' || typeof PERSONAS === 'undefined') return null;
  var match = null;
  roster.forEach(function(name) {
    if (!match && PERSONAS[name] && PERSONAS[name].race === arcana) match = name;
  });
  return match;
}

function slScoreLink(arcana) {
  var link = SOCIAL_LINKS[arcana];
  var currentRank = slState.ranks[arcana] || 0;
  if (currentRank >= 10) return { score: -1, factors: [] };

  var score = 0;
  var factors = [];
  var fusion = slGetFusionData(arcana);

  // 1. Fusion Value (0-25 pts)
  var fusionScore = Math.round((fusion.pairs / 12) * 15);
  var personaBonus = Math.round((fusion.personas / 12) * 10);
  score += fusionScore + personaBonus;
  if (fusionScore >= 10) factors.push('High fusion value (' + fusion.pairs + ' recipe pairs)');
  if (personaBonus >= 5) factors.push(fusion.personas + ' personas in this arcana');

  // 2. Rank Progression Priority (0-20 pts)
  var rankScore = Math.round((10 - currentRank) * 2);
  score += rankScore;
  if (currentRank === 0) factors.push('Not started \u2014 high growth potential');
  else if (currentRank <= 3) factors.push('Early ranks \u2014 big gains ahead');

  // 3. Limited Availability Urgency (0-15 pts)
  if (link.endDate) {
    var daysLeft = slDaysBetween(slState.gameDate, link.endDate);
    if (daysLeft > 0 && daysLeft <= 30) {
      var urgency = Math.round(15 * (1 - daysLeft / 30));
      score += urgency;
      factors.push('Window closing in ~' + daysLeft + ' days');
    } else if (daysLeft <= 0) {
      score -= 100;
      factors.push('EXPIRED');
    }
  }
  var daysPerWeek = link.availableDays.length;
  if (daysPerWeek > 0 && daysPerWeek <= 2) {
    score += 5;
    factors.push('Only available ' + daysPerWeek + ' day' + (daysPerWeek > 1 ? 's' : '') + '/week');
  }

  // 4. Stat Requirements (-50 if unmet)
  if (!slStatsMet(arcana)) {
    score -= 50;
    var reqs = [];
    for (var stat in link.statRequirements) {
      reqs.push(SOCIAL_STATS[stat][link.statRequirements[stat] - 1] + ' ' + stat);
    }
    factors.push('LOCKED \u2014 requires ' + reqs.join(', '));
  }

  // 5. Close to Max Bonus (0-10 pts)
  if (currentRank >= 7) {
    var closeBonus = [0,0,0,0,0,0,0,3,6,10][currentRank];
    score += closeBonus;
    factors.push('Almost maxed \u2014 rank ' + currentRank + '/10');
  }

  // 6. Time Slot Rarity (0-3 pts)
  if (link.timeSlot === 'evening') {
    score += 3;
    factors.push('Evening slot (doesn\'t use daytime)');
  }

  // 7. Roster Arcana Match (Feature 2: Cross-Section Bridge)
  var rosterMatch = slGetRosterMatchForArcana(arcana);
  if (rosterMatch) {
    score += 5;
    factors.push('Have ' + rosterMatch + ' for arcana bonus');
  } else if (typeof roster !== 'undefined' && roster.size > 0) {
    score -= 2;
    factors.push('No ' + arcana + ' persona in roster');
  }

  return { score: score, factors: factors };
}

function slGetRecommendations(timeSlot) {
  var available = slGetAvailableLinks(slState.gameDate, timeSlot);
  available.forEach(function(item) {
    var result = slScoreLink(item.arcana);
    item.score = result.score;
    item.factors = result.factors;
  });
  available.sort(function(a, b) { return b.score - a.score; });
  return available;
}

// ========== RENDERING: DASHBOARD ==========
function slRenderDashboard() {
  slRenderStatusBar();
  slRenderProgressGrid();
  slRenderRecommendations();
}

function slRenderStatusBar() {
  // Month select
  var monthSel = document.getElementById('sl-month');
  if (monthSel && !monthSel.dataset.init) {
    monthSel.dataset.init = '1';
    var months = [4,5,6,7,8,9,10,11,12,1];
    monthSel.innerHTML = months.map(function(m) {
      return '<option value="' + m + '">' + MONTH_NAMES[m] + '</option>';
    }).join('');
  }
  if (monthSel) monthSel.value = slState.gameDate.month;

  // Day select
  slUpdateDaySelect();

  // Stat selects
  ['academics','charm','courage'].forEach(function(stat) {
    var sel = document.getElementById('sl-' + stat);
    if (sel && !sel.dataset.init) {
      sel.dataset.init = '1';
      sel.innerHTML = SOCIAL_STATS[stat].map(function(label, i) {
        return '<option value="' + (i + 1) + '">' + (i + 1) + ' - ' + label + '</option>';
      }).join('');
    }
    if (sel) sel.value = slState.stats[stat];
  });
}

function slUpdateDaySelect() {
  var daySel = document.getElementById('sl-day');
  if (!daySel) return;
  var m = slState.gameDate.month;
  var maxDay = DAYS_IN_MONTH[m];
  var cur = daySel.value;
  daySel.innerHTML = '';
  for (var d = 1; d <= maxDay; d++) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    daySel.appendChild(opt);
  }
  daySel.value = Math.min(slState.gameDate.day, maxDay);
}

function slRenderProgressGrid() {
  var grid = document.getElementById('sl-progress-grid');
  if (!grid) return;
  var html = '';
  SL_ARCANA_ORDER.forEach(function(arcana) {
    var link = SOCIAL_LINKS[arcana];
    if (!link) return;
    var rank = slState.ranks[arcana] || 0;
    var pct = (rank / 10) * 100;
    var cls = 'sl-progress-item';
    if (rank >= 10) cls += ' maxed';
    if (link.automatic) cls += ' automatic';
    html += '<div class="' + cls + '">' +
      '<div class="sl-progress-top">' +
        '<span class="sl-progress-arcana">' + arcana + '</span>' +
        '<span class="sl-progress-rank">' + (rank >= 10 ? 'MAX' : 'Rk ' + rank) + '</span>' +
      '</div>' +
      '<div class="sl-progress-char">' + link.character + '</div>' +
      '<div class="sl-progress-bar"><div class="sl-progress-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
  });
  grid.innerHTML = html;
}

function slRenderRecommendations() {
  var container = document.getElementById('sl-recommendations');
  if (!container) return;

  // Determine active time slot
  var activeBtn = document.querySelector('#social-links .sl-time-btn.active');
  var timeSlot = activeBtn ? activeBtn.dataset.slot : 'day';

  var blocked = slGetBlockedReason(slState.gameDate.month, slState.gameDate.day, timeSlot);
  if (blocked) {
    container.innerHTML = '<div class="sl-rec-empty">' + blocked + ' \u2014 no social links available.</div>';
    return;
  }

  var recs = slGetRecommendations(timeSlot);
  if (recs.length === 0) {
    container.innerHTML = '<div class="sl-rec-empty">No social links available for this ' + timeSlot + ' slot on ' + slFormatDate(slState.gameDate) + '.</div>';
    return;
  }

  var html = '';
  recs.forEach(function(item) {
    var isLocked = item.score < 0 && !item.statsMet;
    var cls = 'sl-rec-item' + (isLocked ? ' locked' : '');
    // Build next-rank answer preview
    var previewHtml = '';
    var nextRank = item.rank + 1;
    var nextRankData = item.link.ranks ? item.link.ranks.find(function(r) { return r.rank === nextRank; }) : null;
    if (nextRankData && nextRankData.answers && nextRankData.answers.length) {
      var bestOpt = nextRankData.answers[0].options.slice().sort(function(a,b) { return b.points - a.points; })[0];
      if (bestOpt) {
        previewHtml = '<div class="sl-rec-answers-preview">Best answer: <span class="sl-rec-ans sl-rec-best">"' + bestOpt.text + '"</span></div>';
      }
    }

    // Persona match badge (Feature 2)
    var matchBadge = '';
    var rMatch = slGetRosterMatchForArcana(item.arcana);
    if (rMatch) {
      matchBadge = '<span class="sl-rec-match sl-rec-match-ok">Have: ' + rMatch + '</span>';
    } else if (typeof roster !== 'undefined' && roster.size > 0) {
      matchBadge = '<span class="sl-rec-match sl-rec-match-gap">No ' + item.arcana + ' persona</span>';
    }

    html += '<div class="' + cls + '">' +
      '<div class="sl-rec-score">' + Math.max(0, item.score) + '</div>' +
      '<div class="sl-rec-info">' +
        '<div><span class="sl-rec-name">' + item.link.character + '</span>' +
        '<span class="sl-rec-arcana">' + item.arcana + '</span>' + matchBadge + '</div>' +
        '<div class="sl-rec-detail">' + item.factors.slice(0, 3).join(' \u2022 ') + '</div>' +
        previewHtml +
      '</div>' +
      '<div class="sl-rec-rank-badge">Rk ' + item.rank + '/10</div>' +
    '</div>';
  });
  container.innerHTML = html;
}

// ========== RENDERING: MY LINKS ==========
function slRenderMyLinks() {
  var grid = document.getElementById('sl-links-grid');
  if (!grid) return;

  var statusFilter = document.getElementById('sl-filter-status');
  var timeFilter = document.getElementById('sl-filter-time');
  var filterStatus = statusFilter ? statusFilter.value : '';
  var filterTime = timeFilter ? timeFilter.value : '';

  var html = '';
  SL_ARCANA_ORDER.forEach(function(arcana) {
    var link = SOCIAL_LINKS[arcana];
    if (!link) return;
    var rank = slState.ranks[arcana] || 0;

    // Apply filters
    if (filterStatus === 'active' && (rank === 0 || rank >= 10 || link.automatic)) return;
    if (filterStatus === 'maxed' && rank < 10) return;
    if (filterStatus === 'locked' && (rank > 0 || link.automatic)) return;
    if (filterStatus === 'unavailable' && (slIsUnlocked(arcana) && !slIsExpired(arcana))) return;
    if (filterTime && link.timeSlot !== filterTime) return;

    var cls = 'sl-link-card';
    if (rank >= 10) cls += ' maxed';
    if (link.automatic) cls += ' automatic';

    // Build days row
    var daysHtml = '';
    DAY_NAMES.forEach(function(name, i) {
      var avail = link.availableDays.indexOf(i) !== -1;
      daysHtml += '<span class="sl-day-badge' + (avail ? ' available' : '') + '">' + name.charAt(0) + '</span>';
    });

    // Build meta badges
    var metaHtml = '<span class="sl-meta-badge sl-meta-location">' + link.location + '</span>';
    if (link.timeSlot) {
      metaHtml += '<span class="sl-meta-badge sl-meta-time-' + link.timeSlot + '">' +
        (link.timeSlot === 'day' ? 'Daytime' : 'Evening') + '</span>';
    }
    if (link.unlockDate) {
      metaHtml += '<span class="sl-meta-badge sl-meta-unlock">Unlocks ' + slFormatDate(link.unlockDate) + '</span>';
    }
    for (var stat in link.statRequirements) {
      var met = (slState.stats[stat] || 1) >= link.statRequirements[stat];
      metaHtml += '<span class="sl-meta-badge sl-meta-stat' + (met ? '' : ' unmet') + '">' +
        SOCIAL_STATS[stat][link.statRequirements[stat] - 1] + ' ' + stat +
        (met ? ' \u2713' : ' \u2717') + '</span>';
    }

    // Build rank dots
    var rankHtml = '';
    if (!link.automatic) {
      rankHtml = '<div class="sl-rank-selector"><span class="sl-rank-label">Rank</span><div class="sl-rank-dots">';
      for (var r = 1; r <= 10; r++) {
        var dotCls = 'sl-rank-dot';
        if (r <= rank && rank >= 10) dotCls += ' maxed';
        else if (r <= rank) dotCls += ' filled';
        rankHtml += '<button class="' + dotCls + '" data-arcana="' + arcana + '" data-rank="' + r + '">' + r + '</button>';
      }
      rankHtml += '</div></div>';
    } else {
      rankHtml = '<div class="sl-note">Progresses automatically through the story.</div>';
    }

    // Build answer guide (for non-automatic links with answer data)
    var answerHtml = '';
    var hasAnswers = !link.automatic && link.ranks.some(function(r) { return r.answers && r.answers.length; });
    if (hasAnswers) {
      answerHtml = '<button class="sl-expand-btn" data-arcana="' + arcana + '">' +
        '<span class="sl-expand-arrow">&#9654;</span> Answer Guide</button>' +
        '<div class="sl-answer-guide">' +
        '<div class="sl-persona-reminder">&#9733; Carry a ' + arcana + ' Persona for +1 bonus points per answer</div>';
      link.ranks.forEach(function(r) {
        if (!r.answers || !r.answers.length) {
          if (r.note && r.rank === 10) {
            answerHtml += '<div class="sl-answer-rank"><div class="sl-answer-rank-header">Rank ' + r.rank + '</div>' +
              '<div class="sl-answer-note">' + r.note + '</div></div>';
          }
          return;
        }
        var isNext = r.rank === rank + 1;
        answerHtml += '<div class="sl-answer-rank' + (isNext ? ' highlight' : '') + '">' +
          '<div class="sl-answer-rank-header">Rank ' + r.rank +
          (isNext ? ' <span class="sl-next-badge">Next</span>' : '') + '</div>';
        if (r.note) answerHtml += '<div class="sl-answer-note">' + r.note + '</div>';
        r.answers.forEach(function(a) {
          answerHtml += '<div class="sl-answer-prompt">' + a.prompt + '</div><div class="sl-answer-options">';
          // Sort by points descending
          var sorted = a.options.slice().sort(function(x,y) { return y.points - x.points; });
          sorted.forEach(function(opt) {
            var cls = opt.points >= 3 ? 'sl-answer-best' : opt.points === 2 ? 'sl-answer-good' : opt.points === 1 ? 'sl-answer-neutral' : 'sl-answer-bad';
            answerHtml += '<div class="sl-answer-option ' + cls + '">' +
              '<span class="sl-pts">+' + opt.points + '</span>' +
              '<span class="sl-answer-text">' + opt.text + '</span></div>';
          });
          answerHtml += '</div>';
        });
        answerHtml += '</div>';
      });
      answerHtml += '</div>';
    }

    html += '<div class="' + cls + '">' +
      '<div class="sl-link-card-header">' +
        '<span class="sl-link-card-title">' + link.character + '</span>' +
        '<span class="sl-link-card-arcana">' + arcana + '</span>' +
      '</div>' +
      '<div class="sl-link-card-desc">' + link.description + '</div>' +
      '<div class="sl-link-card-meta">' + metaHtml + '</div>' +
      '<div class="sl-days-row">' + daysHtml + '</div>' +
      rankHtml +
      answerHtml +
    '</div>';
  });

  if (!html) {
    html = '<div class="sl-rec-empty">No links match the current filters.</div>';
  }
  grid.innerHTML = html;
}

// ========== RENDERING: CALENDAR ==========
var slCalWeekStart = null;

function slRenderCalendar() {
  if (!slCalWeekStart) {
    slCalWeekStart = slGetMonday(slState.gameDate);
  }

  var title = document.getElementById('sl-cal-title');
  if (title) title.textContent = 'Week of ' + slFormatDate(slCalWeekStart);

  var grid = document.getElementById('sl-calendar-grid');
  if (!grid) return;

  var html = '';
  for (var i = 0; i < 7; i++) {
    var date = slAdvanceDate(slCalWeekStart, i);
    var dow = slGetDayOfWeek(date.month, date.day);
    var isToday = date.month === slState.gameDate.month && date.day === slState.gameDate.day;
    var blockedDay = slGetBlockedReason(date.month, date.day, 'day');
    var blockedEve = slGetBlockedReason(date.month, date.day, 'evening');

    var cls = 'sl-cal-day';
    if (isToday) cls += ' today';
    if (blockedDay && blockedEve) cls += ' blocked';

    html += '<div class="' + cls + '">';
    html += '<div class="sl-cal-day-header">' +
      '<span class="sl-cal-day-name">' + DAY_NAMES[dow] + '</span>' +
      '<span class="sl-cal-day-date">' + slFormatDate(date) + '</span>' +
    '</div>';

    if (blockedDay && blockedEve) {
      html += '<div class="sl-cal-blocked-label">' + (blockedDay || blockedEve) + '</div>';
    } else if (blockedDay) {
      html += '<div class="sl-cal-blocked-label">Day: ' + blockedDay + '</div>';
    } else if (blockedEve) {
      html += '<div class="sl-cal-blocked-label">Eve: ' + blockedEve + '</div>';
    }

    html += '<div class="sl-cal-links">';

    // Day links
    if (!blockedDay) {
      var dayLinks = slGetCalLinks(date, dow, 'day');
      dayLinks.forEach(function(item) { html += slCalLinkHtml(item, 'day'); });
    }
    // Evening links
    if (!blockedEve) {
      var eveLinks = slGetCalLinks(date, dow, 'evening');
      eveLinks.forEach(function(item) { html += slCalLinkHtml(item, 'evening'); });
    }

    html += '</div></div>';
  }
  grid.innerHTML = html;
}

function slGetCalLinks(date, dow, timeSlot) {
  var results = [];
  SL_ARCANA_ORDER.forEach(function(arcana) {
    var link = SOCIAL_LINKS[arcana];
    if (!link || link.automatic) return;
    if (link.timeSlot !== timeSlot) return;
    if (slCompareDates(date, link.unlockDate) < 0) return;
    if (link.endDate && slCompareDates(date, link.endDate) > 0) return;
    if (link.availableDays.indexOf(dow) === -1) return;
    results.push({
      arcana: arcana,
      character: link.character,
      rank: slState.ranks[arcana] || 0,
      statsMet: slStatsMet(arcana),
      maxed: (slState.ranks[arcana] || 0) >= 10
    });
  });
  return results;
}

function slCalLinkHtml(item, timeSlot) {
  var cls = 'sl-cal-link';
  if (!item.statsMet) cls += ' locked';
  if (item.maxed) cls += ' locked';
  return '<div class="' + cls + '">' +
    '<span class="sl-cal-link-dot ' + timeSlot + '"></span>' +
    '<span class="sl-cal-link-name">' + item.character + '</span>' +
    '<span class="sl-cal-link-rank">' + (item.maxed ? 'MAX' : item.rank) + '</span>' +
  '</div>';
}

// ========== SUB-TAB SWITCHING ==========
function slSwitchTab(tabName) {
  document.querySelectorAll('#social-links .sl-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('#social-links .sl-tab-content').forEach(function(tc) {
    tc.classList.toggle('active', tc.id === 'sl-tab-' + tabName);
  });
  if (tabName === 'dashboard') slRenderDashboard();
  if (tabName === 'my-links') slRenderMyLinks();
  if (tabName === 'calendar') slRenderCalendar();
}

// ========== EVENT HANDLERS ==========
function slOnDateChange() {
  var monthSel = document.getElementById('sl-month');
  var daySel = document.getElementById('sl-day');
  if (daySel) slState.gameDate.day = parseInt(daySel.value);
  if (monthSel) slState.gameDate.month = parseInt(monthSel.value);
  slUpdateDaySelect();
  slSave();
  slCalWeekStart = null; // Reset calendar to current week
  slRenderProgressGrid();
  slRenderRecommendations();
}

function slOnStatChange() {
  ['academics','charm','courage'].forEach(function(stat) {
    var sel = document.getElementById('sl-' + stat);
    if (sel) slState.stats[stat] = parseInt(sel.value);
  });
  slSave();
  slRenderRecommendations();
}

function slOnRankClick(e) {
  var btn = e.target.closest('.sl-rank-dot');
  if (!btn) return;
  var arcana = btn.dataset.arcana;
  var rank = parseInt(btn.dataset.rank);
  // Toggle: if clicking the current rank, set to rank-1 (deselect)
  if (slState.ranks[arcana] === rank) {
    slState.ranks[arcana] = rank - 1;
  } else {
    slState.ranks[arcana] = rank;
  }
  slSave();
  slRenderMyLinks();
  // Also refresh dashboard if it's been rendered
  slRenderProgressGrid();
}

function slOnTimeToggle(e) {
  var btn = e.target.closest('.sl-time-btn');
  if (!btn) return;
  document.querySelectorAll('#social-links .sl-time-btn').forEach(function(b) {
    b.classList.toggle('active', b === btn);
  });
  slRenderRecommendations();
}

function slOnFilterChange() {
  slRenderMyLinks();
}

function slOnCalPrev() {
  slCalWeekStart = slAdvanceDate(slCalWeekStart, -7);
  slRenderCalendar();
}

function slOnCalNext() {
  slCalWeekStart = slAdvanceDate(slCalWeekStart, 7);
  slRenderCalendar();
}

// ========== INIT ==========
function initSocialLinks() {
  slState = slLoad();

  // Sub-tab switching
  document.querySelectorAll('#social-links .sl-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { slSwitchTab(this.dataset.tab); });
  });

  // Date/stat change listeners
  var monthSel = document.getElementById('sl-month');
  var daySel = document.getElementById('sl-day');
  if (monthSel) monthSel.addEventListener('change', slOnDateChange);
  if (daySel) daySel.addEventListener('change', slOnDateChange);
  ['academics','charm','courage'].forEach(function(stat) {
    var sel = document.getElementById('sl-' + stat);
    if (sel) sel.addEventListener('change', slOnStatChange);
  });

  // Time slot toggle
  document.querySelectorAll('#social-links .sl-time-btn').forEach(function(btn) {
    btn.addEventListener('click', slOnTimeToggle);
  });

  // Rank dots (delegated)
  var linksGrid = document.getElementById('sl-links-grid');
  if (linksGrid) linksGrid.addEventListener('click', slOnRankClick);

  // Answer guide expand/collapse (delegated)
  if (linksGrid) linksGrid.addEventListener('click', function(e) {
    var btn = e.target.closest('.sl-expand-btn');
    if (!btn) return;
    var card = btn.closest('.sl-link-card');
    if (card) card.classList.toggle('expanded');
  });

  // Filters
  var filterStatus = document.getElementById('sl-filter-status');
  var filterTime = document.getElementById('sl-filter-time');
  if (filterStatus) filterStatus.addEventListener('change', slOnFilterChange);
  if (filterTime) filterTime.addEventListener('change', slOnFilterChange);

  // Calendar nav
  var calPrev = document.getElementById('sl-cal-prev');
  var calNext = document.getElementById('sl-cal-next');
  if (calPrev) calPrev.addEventListener('click', slOnCalPrev);
  if (calNext) calNext.addEventListener('click', slOnCalNext);

  // Initial render
  slRenderDashboard();
}

function reloadSocialLinks() {
  slState = slLoad();
  slRenderDashboard();
  slRenderMyLinks();
  slRenderCalendar();
}
window.reloadSocialLinks = reloadSocialLinks;
