(() => {
let slRoot;
let slStore;
let slState = null;
let slCalWeekStart = null;
let slFusionCache = null;
let slLastDateKey = '';
let initialized = false;

function syncState() {
  const snapshot = slStore.getState();
  const dateKey = `${snapshot.profile.gameDate.month}-${snapshot.profile.gameDate.day}`;
  if (slLastDateKey && slLastDateKey !== dateKey) {
    slCalWeekStart = null;
  }
  slLastDateKey = dateKey;
  slState = {
    ranks: snapshot.socialLinks.ranks,
    gameDate: snapshot.profile.gameDate,
    stats: snapshot.profile.stats
  };
}

function getRosterSet() {
  return new Set(slStore.getState().roster);
}

function slGetDayOfWeek(month, day) {
  const year = month >= 2 ? 2009 : 2010;
  return new Date(year, month - 1, day).getDay();
}

function slDateToNum(date) {
  const month = date.month >= 4 ? date.month : date.month + 12;
  return month * 100 + date.day;
}

function slCompareDates(left, right) {
  return slDateToNum(left) - slDateToNum(right);
}

function slFormatDate(date) {
  return `${MONTH_NAMES[date.month]} ${date.day}`;
}

function slDaysBetween(left, right) {
  const leftYear = left.month >= 4 ? 2009 : 2010;
  const rightYear = right.month >= 4 ? 2009 : 2010;
  const leftDate = new Date(leftYear, left.month - 1, left.day);
  const rightDate = new Date(rightYear, right.month - 1, right.day);
  return Math.round((rightDate - leftDate) / 86400000);
}

function slAdvanceDate(date, days) {
  const year = date.month >= 4 ? 2009 : 2010;
  const current = new Date(year, date.month - 1, date.day);
  current.setDate(current.getDate() + days);
  return {
    month: current.getMonth() + 1,
    day: current.getDate()
  };
}

function slGetMonday(date) {
  const year = date.month >= 4 ? 2009 : 2010;
  const current = new Date(year, date.month - 1, date.day);
  const dayOfWeek = current.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + diff);
  return {
    month: current.getMonth() + 1,
    day: current.getDate()
  };
}

function slIsExpired(arcana) {
  const link = SOCIAL_LINKS[arcana];
  if (!link || !link.endDate) {
    return false;
  }
  return slCompareDates(slState.gameDate, link.endDate) > 0;
}

function slStatsMet(arcana) {
  const link = SOCIAL_LINKS[arcana];
  if (!link) {
    return false;
  }
  return Object.entries(link.statRequirements).every(
    ([stat, requirement]) => (slState.stats[stat] || 1) >= requirement
  );
}

function slGetBlockedReason(month, day, timeSlot) {
  const dayNumber = slDateToNum({ month, day });
  for (const blocked of BLOCKED_DATES) {
    if (dayNumber >= slDateToNum(blocked.from) && dayNumber <= slDateToNum(blocked.to)) {
      if (blocked.block === 'both' || blocked.block === timeSlot) {
        return blocked.reason;
      }
    }
  }
  return null;
}

function slGetAvailableLinks(date, timeSlot) {
  const dayOfWeek = slGetDayOfWeek(date.month, date.day);
  const results = [];
  ARCANA_LIST.forEach((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    if (!link || link.automatic) {
      return;
    }
    if (slCompareDates(date, link.unlockDate) < 0) {
      return;
    }
    if (link.endDate && slCompareDates(date, link.endDate) > 0) {
      return;
    }
    if (timeSlot && link.timeSlot !== timeSlot) {
      return;
    }
    if (!link.availableDays.includes(dayOfWeek)) {
      return;
    }
    if ((slState.ranks[arcana] || 0) >= 10) {
      return;
    }
    results.push({
      arcana,
      link,
      rank: slState.ranks[arcana] || 0,
      statsMet: slStatsMet(arcana),
      blocked: slGetBlockedReason(date.month, date.day, link.timeSlot)
    });
  });
  return results;
}

function slCountFusionPairs(arcana) {
  let count = 0;
  for (const sourceArcana in ARCANA_CHART) {
    for (const targetArcana in ARCANA_CHART[sourceArcana]) {
      if (ARCANA_CHART[sourceArcana][targetArcana] === arcana) {
        count += 1;
      }
    }
  }
  return Math.ceil(count / 2);
}

function slCountPersonas(arcana) {
  let count = 0;
  Object.values(PERSONAS).forEach((persona) => {
    if (persona.race === arcana) {
      count += 1;
    }
  });
  return count;
}

function slGetFusionData(arcana) {
  if (!slFusionCache) {
    slFusionCache = {};
    ARCANA_LIST.forEach((entry) => {
      slFusionCache[entry] = {
        pairs: slCountFusionPairs(entry),
        personas: slCountPersonas(entry)
      };
    });
  }
  return slFusionCache[arcana] || { pairs: 0, personas: 0 };
}

function slGetRosterMatchForArcana(arcana) {
  const roster = getRosterSet();
  for (const name of roster) {
    if (PERSONAS[name] && PERSONAS[name].race === arcana) {
      return name;
    }
  }
  return null;
}

function slScoreLink(arcana) {
  const link = SOCIAL_LINKS[arcana];
  const currentRank = slState.ranks[arcana] || 0;
  if (currentRank >= 10) {
    return { score: -1, factors: [] };
  }

  let score = 0;
  const factors = [];
  const fusion = slGetFusionData(arcana);

  const fusionScore = Math.round((fusion.pairs / 12) * 15);
  const personaBonus = Math.round((fusion.personas / 12) * 10);
  score += fusionScore + personaBonus;
  if (fusionScore >= 10) {
    factors.push(`High fusion value (${fusion.pairs} recipe pairs)`);
  }
  if (personaBonus >= 5) {
    factors.push(`${fusion.personas} personas in this arcana`);
  }

  const rankScore = Math.round((10 - currentRank) * 2);
  score += rankScore;
  if (currentRank === 0) {
    factors.push('Not started - high growth potential');
  } else if (currentRank <= 3) {
    factors.push('Early ranks - big gains ahead');
  }

  if (link.endDate) {
    const daysLeft = slDaysBetween(slState.gameDate, link.endDate);
    if (daysLeft > 0 && daysLeft <= 30) {
      const urgency = Math.round(15 * (1 - daysLeft / 30));
      score += urgency;
      factors.push(`Window closing in ~${daysLeft} days`);
    } else if (daysLeft <= 0) {
      score -= 100;
      factors.push('EXPIRED');
    }
  }

  if (link.availableDays.length > 0 && link.availableDays.length <= 2) {
    score += 5;
    factors.push(
      `Only available ${link.availableDays.length} day${link.availableDays.length > 1 ? 's' : ''}/week`
    );
  }

  if (!slStatsMet(arcana)) {
    score -= 50;
    const requirements = Object.entries(link.statRequirements).map(
      ([stat, requirement]) => `${SOCIAL_STATS[stat][requirement - 1]} ${stat}`
    );
    factors.push(`LOCKED - requires ${requirements.join(', ')}`);
  }

  if (currentRank >= 7) {
    score += [0, 0, 0, 0, 0, 0, 0, 3, 6, 10][currentRank];
    factors.push(`Almost maxed - rank ${currentRank}/10`);
  }

  if (link.timeSlot === 'evening') {
    score += 3;
    factors.push('Evening slot (does not use daytime)');
  }

  const rosterMatch = slGetRosterMatchForArcana(arcana);
  const roster = getRosterSet();
  if (rosterMatch) {
    score += 5;
    factors.push(`Have ${rosterMatch} for arcana bonus`);
  } else if (roster.size > 0) {
    score -= 2;
    factors.push(`No ${arcana} persona in roster`);
  }

  return { score, factors };
}

function slGetRecommendations(timeSlot) {
  const available = slGetAvailableLinks(slState.gameDate, timeSlot);
  available.forEach((item) => {
    const result = slScoreLink(item.arcana);
    item.score = result.score;
    item.factors = result.factors;
  });
  available.sort((left, right) => right.score - left.score);
  return available;
}

function slGetLinkExtra(arcana) {
  if (typeof SOCIAL_LINK_EXTRAS === 'undefined') {
    return null;
  }
  return SOCIAL_LINK_EXTRAS[arcana] || null;
}

function slGetStatGuide(stat) {
  if (typeof SOCIAL_STAT_ACTIVITY_GUIDES === 'undefined') {
    return [];
  }
  return SOCIAL_STAT_ACTIVITY_GUIDES[stat] || [];
}

function slGetDeadlineLabel(link) {
  if (!link?.endDate) {
    return '';
  }
  const daysLeft = slDaysBetween(slState.gameDate, link.endDate);
  if (daysLeft < 0) {
    return 'expired';
  }
  if (daysLeft === 0) {
    return 'last day';
  }
  return `${daysLeft}d left`;
}

function slGetHighPressureLinks() {
  const items = [];
  ARCANA_LIST.forEach((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    if (!link || link.automatic || (slState.ranks[arcana] || 0) >= 10) {
      return;
    }
    const extra = slGetLinkExtra(arcana);
    let pressure = 0;
    const reasons = [];
    if (link.endDate) {
      const daysLeft = slDaysBetween(slState.gameDate, link.endDate);
      if (daysLeft >= 0) {
        pressure += Math.max(0, 50 - Math.min(daysLeft, 50));
        reasons.push(slGetDeadlineLabel(link));
      }
    }
    if (extra?.deadline) {
      pressure += 8;
      reasons.push('deadline-sensitive');
    }
    if (!slStatsMet(arcana)) {
      pressure += 6;
      reasons.push('stat-gated');
    }
    if ((slState.ranks[arcana] || 0) === 0) {
      pressure += 4;
      reasons.push('not started');
    }
    if (pressure > 0) {
      items.push({
        arcana,
        character: link.character,
        pressure,
        reasons: [...new Set(reasons)].filter(Boolean),
        extra,
        rank: slState.ranks[arcana] || 0
      });
    }
  });
  return items.sort((left, right) => right.pressure - left.pressure).slice(0, 4);
}

function slGetStatBottlenecks() {
  const bottlenecks = {
    academics: [],
    charm: [],
    courage: []
  };

  ARCANA_LIST.forEach((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    if (!link || link.automatic || (slState.ranks[arcana] || 0) >= 10) {
      return;
    }
    Object.entries(link.statRequirements).forEach(([stat, requirement]) => {
      const current = slState.stats[stat] || 1;
      if (current >= requirement) {
        return;
      }
      bottlenecks[stat].push({
        arcana,
        character: link.character,
        current,
        requirement,
        delta: requirement - current
      });
    });
  });

  Object.values(bottlenecks).forEach((entries) => {
    entries.sort((left, right) => left.delta - right.delta || left.requirement - right.requirement);
  });

  return bottlenecks;
}

function slRenderPlanningInsights() {
  const container = slRoot.querySelector('#sl-planning-insights');
  if (!container) {
    return;
  }

  const highPressure = slGetHighPressureLinks();
  const bottlenecks = slGetStatBottlenecks();

  let html = '<div class="sl-planning-grid">';

  html += '<section class="sl-planning-panel"><h3>High-Pressure Routes</h3>';
  if (!highPressure.length) {
    html += '<div class="sl-rec-empty">No urgent route pressure detected from your current state.</div>';
  } else {
    html += highPressure
      .map((item) => {
        const extraLine = item.extra?.deadline || item.extra?.priority || '';
        return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">Rank ${item.rank}/10${item.reasons.length ? ` - ${item.reasons.join(', ')}` : ''}</div>${extraLine ? `<div class="sl-focus-note">${extraLine}</div>` : ''}</div>`;
      })
      .join('');
  }
  html += '</section>';

  html += '<section class="sl-planning-panel"><h3>Stat Bottlenecks</h3>';
  html += ['academics', 'charm', 'courage']
    .map((stat) => {
      const entries = bottlenecks[stat];
      const guide = slGetStatGuide(stat);
      if (!entries.length) {
        return `<div class="sl-stat-focus"><div class="sl-stat-focus-top"><span class="sl-stat-focus-name">${stat}</span><span class="sl-stat-focus-clear">clear</span></div><div class="sl-focus-note">No current social link is blocked by this stat.</div></div>`;
      }
      const targets = entries
        .map((entry) => `<span class="sl-stat-target">${entry.character} (${entry.current} -> ${entry.requirement})</span>`)
        .join('');
      const guideHtml = guide
        .slice(0, 2)
        .map((entry) => `<div class="sl-stat-guide">${entry.name}: ${entry.note}</div>`)
        .join('');
      return `<div class="sl-stat-focus"><div class="sl-stat-focus-top"><span class="sl-stat-focus-name">${stat}</span><span class="sl-stat-focus-gap">+${entries[0].delta} next gate</span></div><div class="sl-stat-targets">${targets}</div>${guideHtml}</div>`;
    })
    .join('');
  html += '</section></div>';

  container.innerHTML = html;
}

function slRenderBestUseBoard() {
  const container = slRoot.querySelector('#sl-next-actions');
  if (!container) {
    return;
  }

  const currentDate = slState.gameDate;
  const dayBlocked = slGetBlockedReason(currentDate.month, currentDate.day, 'day');
  const eveningBlocked = slGetBlockedReason(currentDate.month, currentDate.day, 'evening');
  const dayPick = dayBlocked ? null : slGetRecommendations('day').find((item) => item.score >= 0) || null;
  const eveningPick =
    eveningBlocked ? null : slGetRecommendations('evening').find((item) => item.score >= 0) || null;
  const bottlenecks = slGetStatBottlenecks();

  const renderAction = (label, item, blockedReason, statFallback) => {
    if (blockedReason) {
      return `<div class="sl-action-card blocked"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">Blocked</span></div><div class="sl-action-main">${blockedReason}</div></div>`;
    }
    if (item) {
      const extra = slGetLinkExtra(item.arcana);
      return `<div class="sl-action-card"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">${item.arcana}</span></div><div class="sl-action-main">${item.link.character}</div><div class="sl-action-copy">${item.factors.slice(0, 2).join(' • ')}</div>${
        extra?.deadline ? `<div class="sl-action-note">${extra.deadline}</div>` : ''
      }</div>`;
    }
    return `<div class="sl-action-card"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">Fallback</span></div><div class="sl-action-main">Raise ${statFallback.stat}</div><div class="sl-action-copy">${statFallback.note}</div></div>`;
  };

  const firstBottleneck =
    ['academics', 'charm', 'courage']
      .map((stat) => ({ stat, entries: bottlenecks[stat] }))
      .filter((entry) => entry.entries.length > 0)
      .sort((left, right) => left.entries[0].delta - right.entries[0].delta)[0] || null;

  const fallbackGuide = firstBottleneck
    ? {
        stat: firstBottleneck.stat,
        note: slGetStatGuide(firstBottleneck.stat)[0]?.note || 'Next useful stat gate is currently here.'
      }
    : {
        stat: 'social stats',
        note: 'No urgent gate is blocking your links right now.'
      };

  container.innerHTML =
    renderAction('Today', dayPick, dayBlocked, fallbackGuide) +
    renderAction('Tonight', eveningPick, eveningBlocked, fallbackGuide);
}

function slRenderRiskBoard() {
  const container = slRoot.querySelector('#sl-risk-board');
  if (!container) {
    return;
  }

  const currentDate = slState.gameDate;
  const items = ARCANA_LIST.map((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    const extra = slGetLinkExtra(arcana);
    const rank = slState.ranks[arcana] || 0;
    if (!link || link.automatic || rank >= 10) {
      return null;
    }

    let urgency = 0;
    const reasons = [];
    if (link.endDate) {
      const daysLeft = slDaysBetween(currentDate, link.endDate);
      if (daysLeft >= 0 && daysLeft <= 45) {
        urgency += 80 - daysLeft;
        reasons.push(`${daysLeft} day${daysLeft === 1 ? '' : 's'} to cutoff`);
      }
    }
    if (extra?.deadline) {
      urgency += 10;
      reasons.push(extra.deadline);
    }
    if (link.availableDays.length <= 2) {
      urgency += 12;
      reasons.push(`${link.availableDays.length} day${link.availableDays.length === 1 ? '' : 's'} / week`);
    }
    if (!slStatsMet(arcana)) {
      const statEntry = Object.entries(link.statRequirements).find(
        ([stat, requirement]) => (slState.stats[stat] || 1) < requirement
      );
      if (statEntry) {
        urgency += 14;
        reasons.push(`${statEntry[0]} gate`);
      }
    }
    if (rank === 0 && link.timeSlot === 'day') {
      urgency += 6;
    }

    if (urgency <= 0) {
      return null;
    }

    return {
      arcana,
      character: link.character,
      urgency,
      reasons: reasons.slice(0, 3)
    };
  })
    .filter(Boolean)
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, 5);

  if (!items.length) {
    container.innerHTML = '<div class="sl-rec-empty">No route looks especially fragile from your current date and ranks.</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) =>
        `<div class="sl-risk-item"><div class="sl-risk-top"><span class="sl-risk-name">${item.character}</span><span class="sl-risk-arcana">${item.arcana}</span></div><div class="sl-risk-copy">${item.reasons.join(' • ')}</div></div>`
    )
    .join('');
}

function slRenderStatusBar() {
  const dateNode = slRoot.querySelector('#sl-status-date');
  if (dateNode) {
    dateNode.textContent = slFormatDate(slState.gameDate);
  }
  ['academics', 'charm', 'courage'].forEach((stat) => {
    const valueNode = slRoot.querySelector(`#sl-status-${stat}`);
    if (valueNode) {
      valueNode.textContent = `${slState.stats[stat]} - ${SOCIAL_STATS[stat][slState.stats[stat] - 1]}`;
    }
  });
}

function slRenderProgressGrid() {
  const grid = slRoot.querySelector('#sl-progress-grid');
  if (!grid) {
    return;
  }

  grid.innerHTML = ARCANA_LIST.map((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    const rank = slState.ranks[arcana] || 0;
    const pct = (rank / 10) * 100;
    let cssClass = 'sl-progress-item';
    if (rank >= 10) {
      cssClass += ' maxed';
    }
    if (link.automatic) {
      cssClass += ' automatic';
    }
    return `<div class="${cssClass}"><div class="sl-progress-top"><span class="sl-progress-arcana">${arcana}</span><span class="sl-progress-rank">${rank >= 10 ? 'MAX' : `Rk ${rank}`}</span></div><div class="sl-progress-char">${link.character}</div><div class="sl-progress-bar"><div class="sl-progress-fill" style="width:${pct}%"></div></div></div>`;
  }).join('');
}

function slRenderRecommendations() {
  const container = slRoot.querySelector('#sl-recommendations');
  if (!container) {
    return;
  }

  const activeButton = slRoot.querySelector('.sl-time-btn.active');
  const timeSlot = activeButton ? activeButton.dataset.slot : 'day';
  const blocked = slGetBlockedReason(slState.gameDate.month, slState.gameDate.day, timeSlot);
  if (blocked) {
    container.innerHTML = `<div class="sl-rec-empty">${blocked} - no social links available.</div>`;
    return;
  }

  const recommendations = slGetRecommendations(timeSlot);
  if (recommendations.length === 0) {
    container.innerHTML = `<div class="sl-rec-empty">No social links available for this ${timeSlot} slot on ${slFormatDate(
      slState.gameDate
    )}.</div>`;
    return;
  }

  const roster = getRosterSet();
  container.innerHTML = recommendations
    .map((item) => {
      const isLocked = item.score < 0 && !item.statsMet;
      const nextRank = item.rank + 1;
      const nextRankData = item.link.ranks
        ? item.link.ranks.find((rankEntry) => rankEntry.rank === nextRank)
        : null;
      let preview = '';
      if (nextRankData && nextRankData.answers && nextRankData.answers.length) {
        const bestOption = nextRankData.answers[0].options
          .slice()
          .sort((left, right) => right.points - left.points)[0];
        if (bestOption) {
          preview = `<div class="sl-rec-answers-preview">Best answer: <span class="sl-rec-ans sl-rec-best">"${bestOption.text}"</span></div>`;
        }
      }
      const rosterMatch = slGetRosterMatchForArcana(item.arcana);
      let matchBadge = '';
      if (rosterMatch) {
        matchBadge = `<span class="sl-rec-match sl-rec-match-ok">Have: ${rosterMatch}</span>`;
      } else if (roster.size > 0) {
        matchBadge = `<span class="sl-rec-match sl-rec-match-gap">No ${item.arcana} persona</span>`;
      }
      const extra = slGetLinkExtra(item.arcana);
      const planningLine = extra?.deadline || extra?.priority || '';
      const factorText = item.factors.slice(0, 3).join(' | ');
      return `<div class="sl-rec-item${isLocked ? ' locked' : ''}"><div class="sl-rec-score">${Math.max(
        0,
        item.score
      )}</div><div class="sl-rec-info"><div><span class="sl-rec-name">${item.link.character}</span><span class="sl-rec-arcana">${item.arcana}</span>${matchBadge}</div><div class="sl-rec-detail">${factorText}</div>${planningLine ? `<div class="sl-rec-planning">${planningLine}</div>` : ''}${preview}</div><div class="sl-rec-rank-badge">Rk ${item.rank}/10</div></div>`;
    })
    .join('');
}

function slRenderDashboard() {
  slRenderStatusBar();
  slRenderProgressGrid();
  slRenderRecommendations();
  slRenderBestUseBoard();
  slRenderRiskBoard();
  slRenderPlanningInsights();
}

function slRenderMyLinks() {
  const grid = slRoot.querySelector('#sl-links-grid');
  if (!grid) {
    return;
  }

  const statusFilter = slRoot.querySelector('#sl-filter-status')?.value || '';
  const timeFilter = slRoot.querySelector('#sl-filter-time')?.value || '';

  let html = '';
  ARCANA_LIST.forEach((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    const rank = slState.ranks[arcana] || 0;

    if (statusFilter === 'active' && (rank === 0 || rank >= 10 || link.automatic)) {
      return;
    }
    if (statusFilter === 'maxed' && rank < 10) {
      return;
    }
    if (statusFilter === 'locked' && (rank > 0 || link.automatic)) {
      return;
    }
    if (statusFilter === 'unavailable' && !slIsExpired(arcana) && slCompareDates(slState.gameDate, link.unlockDate) >= 0) {
      return;
    }
    if (timeFilter && link.timeSlot !== timeFilter) {
      return;
    }

    let cssClass = 'sl-link-card';
    if (rank >= 10) {
      cssClass += ' maxed';
    }
    if (link.automatic) {
      cssClass += ' automatic';
    }

    const daysHtml = DAY_NAMES.map(
      (name, index) =>
        `<span class="sl-day-badge${link.availableDays.includes(index) ? ' available' : ''}">${name.charAt(0)}</span>`
    ).join('');

    let metaHtml = `<span class="sl-meta-badge sl-meta-location">${link.location}</span>`;
    if (link.timeSlot) {
      metaHtml += `<span class="sl-meta-badge sl-meta-time-${link.timeSlot}">${link.timeSlot === 'day' ? 'Daytime' : 'Evening'}</span>`;
    }
    metaHtml += `<span class="sl-meta-badge sl-meta-unlock">Unlocks ${slFormatDate(link.unlockDate)}</span>`;
    Object.entries(link.statRequirements).forEach(([stat, requirement]) => {
      const met = (slState.stats[stat] || 1) >= requirement;
      metaHtml += `<span class="sl-meta-badge sl-meta-stat${met ? '' : ' unmet'}">${SOCIAL_STATS[stat][requirement - 1]} ${stat}${met ? ' ✓' : ' ✗'}</span>`;
    });

    let rankHtml = '';
    if (!link.automatic) {
      rankHtml = '<div class="sl-rank-selector"><span class="sl-rank-label">Rank</span><div class="sl-rank-dots">';
      for (let rankNumber = 1; rankNumber <= 10; rankNumber += 1) {
        let dotClass = 'sl-rank-dot';
        if (rankNumber <= rank && rank >= 10) {
          dotClass += ' maxed';
        } else if (rankNumber <= rank) {
          dotClass += ' filled';
        }
        rankHtml += `<button class="${dotClass}" data-arcana="${arcana}" data-rank="${rankNumber}">${rankNumber}</button>`;
      }
      rankHtml += '</div></div>';
    } else {
      rankHtml = '<div class="sl-note">Progresses automatically through the story.</div>';
    }

    let answerHtml = '';
    if (!link.automatic && link.ranks.some((entry) => entry.answers && entry.answers.length)) {
      answerHtml = `<button class="sl-expand-btn" data-arcana="${arcana}"><span class="sl-expand-arrow">&#9654;</span> Answer Guide</button><div class="sl-answer-guide"><div class="sl-persona-reminder">&#9733; Carry a ${arcana} Persona for +1 bonus points per answer</div>`;
      link.ranks.forEach((entry) => {
        if (!entry.answers || !entry.answers.length) {
          if (entry.note && entry.rank === 10) {
            answerHtml += `<div class="sl-answer-rank"><div class="sl-answer-rank-header">Rank ${entry.rank}</div><div class="sl-answer-note">${entry.note}</div></div>`;
          }
          return;
        }
        answerHtml += `<div class="sl-answer-rank${entry.rank === rank + 1 ? ' highlight' : ''}"><div class="sl-answer-rank-header">Rank ${entry.rank}${entry.rank === rank + 1 ? ' <span class="sl-next-badge">Next</span>' : ''}</div>`;
        if (entry.note) {
          answerHtml += `<div class="sl-answer-note">${entry.note}</div>`;
        }
        entry.answers.forEach((answer) => {
          answerHtml += `<div class="sl-answer-prompt">${answer.prompt}</div><div class="sl-answer-options">`;
          answer.options
            .slice()
            .sort((left, right) => right.points - left.points)
            .forEach((option) => {
              const optionClass =
                option.points >= 3
                  ? 'sl-answer-best'
                  : option.points === 2
                    ? 'sl-answer-good'
                    : option.points === 1
                      ? 'sl-answer-neutral'
                      : 'sl-answer-bad';
              answerHtml += `<div class="sl-answer-option ${optionClass}"><span class="sl-pts">+${option.points}</span><span class="sl-answer-text">${option.text}</span></div>`;
            });
          answerHtml += '</div>';
        });
        answerHtml += '</div>';
      });
      answerHtml += '</div>';
    }
    const extra = slGetLinkExtra(arcana);
    let extraHtml = '';
    if (extra) {
      const badgeBits = [];
      if (extra.priority) {
        badgeBits.push(`<span class="sl-extra-chip">${extra.priority}</span>`);
      }
      if (extra.deadline) {
        badgeBits.push(`<span class="sl-extra-chip deadline">Deadline: ${extra.deadline}</span>`);
      }
      if (extra.routeNote) {
        badgeBits.push(`<span class="sl-extra-chip route">${extra.routeNote}</span>`);
      }
      const listBits = (extra.notes || [])
        .slice(0, 3)
        .map((note) => `<div class="sl-extra-note">${note}</div>`)
        .join('');
      if (badgeBits.length || listBits) {
        extraHtml = `<div class="sl-extra-block">${badgeBits.length ? `<div class="sl-extra-chip-row">${badgeBits.join('')}</div>` : ''}${listBits}</div>`;
      }
    }

    html += `<div class="${cssClass}"><div class="sl-link-card-header"><span class="sl-link-card-title">${link.character}</span><span class="sl-link-card-arcana">${arcana}</span></div><div class="sl-link-card-desc">${link.description}</div><div class="sl-link-card-meta">${metaHtml}</div>${extraHtml}<div class="sl-days-row">${daysHtml}</div>${rankHtml}${answerHtml}</div>`;
  });

  grid.innerHTML = html || '<div class="sl-rec-empty">No links match the current filters.</div>';
}

function slGetCalLinks(date, dayOfWeek, timeSlot) {
  const results = [];
  ARCANA_LIST.forEach((arcana) => {
    const link = SOCIAL_LINKS[arcana];
    if (!link || link.automatic || link.timeSlot !== timeSlot) {
      return;
    }
    if (slCompareDates(date, link.unlockDate) < 0) {
      return;
    }
    if (link.endDate && slCompareDates(date, link.endDate) > 0) {
      return;
    }
    if (!link.availableDays.includes(dayOfWeek)) {
      return;
    }
    results.push({
      arcana,
      character: link.character,
      rank: slState.ranks[arcana] || 0,
      statsMet: slStatsMet(arcana),
      maxed: (slState.ranks[arcana] || 0) >= 10
    });
  });
  return results;
}

function slCalLinkHtml(item, timeSlot) {
  let cssClass = 'sl-cal-link';
  if (!item.statsMet || item.maxed) {
    cssClass += ' locked';
  }
  return `<div class="${cssClass}"><span class="sl-cal-link-dot ${timeSlot}"></span><span class="sl-cal-link-name">${item.character}</span><span class="sl-cal-link-rank">${item.maxed ? 'MAX' : item.rank}</span></div>`;
}

function slRenderCalendar() {
  if (!slCalWeekStart) {
    slCalWeekStart = slGetMonday(slState.gameDate);
  }

  const title = slRoot.querySelector('#sl-cal-title');
  if (title) {
    title.textContent = `Week of ${slFormatDate(slCalWeekStart)}`;
  }

  const grid = slRoot.querySelector('#sl-calendar-grid');
  if (!grid) {
    return;
  }

  let html = '';
  for (let index = 0; index < 7; index += 1) {
    const date = slAdvanceDate(slCalWeekStart, index);
    const dayOfWeek = slGetDayOfWeek(date.month, date.day);
    const isToday = date.month === slState.gameDate.month && date.day === slState.gameDate.day;
    const blockedDay = slGetBlockedReason(date.month, date.day, 'day');
    const blockedEvening = slGetBlockedReason(date.month, date.day, 'evening');

    let cssClass = 'sl-cal-day';
    if (isToday) {
      cssClass += ' today';
    }
    if (blockedDay && blockedEvening) {
      cssClass += ' blocked';
    }

    html += `<div class="${cssClass}"><div class="sl-cal-day-header"><span class="sl-cal-day-name">${DAY_NAMES[dayOfWeek]}</span><span class="sl-cal-day-date">${slFormatDate(
      date
    )}</span></div>`;

    if (blockedDay && blockedEvening) {
      html += `<div class="sl-cal-blocked-label">${blockedDay || blockedEvening}</div>`;
    } else if (blockedDay) {
      html += `<div class="sl-cal-blocked-label">Day: ${blockedDay}</div>`;
    } else if (blockedEvening) {
      html += `<div class="sl-cal-blocked-label">Eve: ${blockedEvening}</div>`;
    }

    html += '<div class="sl-cal-links">';
    if (!blockedDay) {
      slGetCalLinks(date, dayOfWeek, 'day').forEach((item) => {
        html += slCalLinkHtml(item, 'day');
      });
    }
    if (!blockedEvening) {
      slGetCalLinks(date, dayOfWeek, 'evening').forEach((item) => {
        html += slCalLinkHtml(item, 'evening');
      });
    }
    html += '</div></div>';
  }

  grid.innerHTML = html;
}

function slSwitchTab(tabName) {
  slRoot.querySelectorAll('.sl-tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
  slRoot.querySelectorAll('.sl-tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `sl-tab-${tabName}`);
  });
  if (tabName === 'dashboard') {
    slRenderDashboard();
  } else if (tabName === 'my-links') {
    slRenderMyLinks();
  } else if (tabName === 'calendar') {
    slRenderCalendar();
  }
}

function slOnRankClick(event) {
  const button = event.target.closest('.sl-rank-dot');
  if (!button) {
    return;
  }
  const arcana = button.dataset.arcana;
  const rank = Number(button.dataset.rank);
  const currentRank = slState.ranks[arcana] || 0;
  slStore.dispatch({
    type: 'SOCIALLINKS_SET_RANK',
    payload: {
      arcana,
      value: currentRank === rank ? rank - 1 : rank
    }
  });
}

function rerenderAll() {
  syncState();
  slRenderDashboard();
  slRenderMyLinks();
  slRenderCalendar();
}

function initSocialLinks({ root, store }) {
  if (initialized) {
    return;
  }

  slRoot = root;
  slStore = store;
  syncState();
  initialized = true;

  slRoot.querySelectorAll('.sl-tab-btn').forEach((button) => {
    button.addEventListener('click', () => slSwitchTab(button.dataset.tab));
  });

  slRoot.querySelectorAll('.sl-time-btn').forEach((button) => {
    button.addEventListener('click', () => {
      slRoot.querySelectorAll('.sl-time-btn').forEach((entry) => {
        entry.classList.toggle('active', entry === button);
      });
      slRenderRecommendations();
    });
  });

  const linksGrid = slRoot.querySelector('#sl-links-grid');
  linksGrid?.addEventListener('click', slOnRankClick);
  linksGrid?.addEventListener('click', (event) => {
    const button = event.target.closest('.sl-expand-btn');
    if (!button) {
      return;
    }
    button.closest('.sl-link-card')?.classList.toggle('expanded');
  });

  slRoot.querySelector('#sl-filter-status')?.addEventListener('change', slRenderMyLinks);
  slRoot.querySelector('#sl-filter-time')?.addEventListener('change', slRenderMyLinks);
  slRoot.querySelector('#sl-cal-prev')?.addEventListener('click', () => {
    slCalWeekStart = slAdvanceDate(slCalWeekStart, -7);
    slRenderCalendar();
  });
  slRoot.querySelector('#sl-cal-next')?.addEventListener('click', () => {
    slCalWeekStart = slAdvanceDate(slCalWeekStart, 7);
    slRenderCalendar();
  });

  slStore.subscribe(rerenderAll);
  slRenderDashboard();
}

window.initSocialLinks = initSocialLinks;
})();
