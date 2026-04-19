(() => {
let slRoot;
let slStore;
let slState = null;
let slCalWeekStart = null;
let slFusionCache = null;
let slLastDateKey = '';
let initialized = false;
const slUiState = {
  myLinksChip: '',
  calendarMode: 'all'
};

function slGetSnapshot() {
  return slStore.getState();
}

function slGetLink(arcana) {
  if (typeof window.getSocialLinkDefinition === 'function') {
    return window.getSocialLinkDefinition(arcana);
  }
  return SOCIAL_LINKS[arcana];
}

function syncState() {
  const snapshot = slGetSnapshot();
  const dateKey = `${snapshot.profile.gameDate.month}-${snapshot.profile.gameDate.day}`;
  if (slLastDateKey && slLastDateKey !== dateKey) {
    slCalWeekStart = slGetMonday(snapshot.profile.gameDate);
  }
  slLastDateKey = dateKey;
  slState = {
    ranks: snapshot.socialLinks.ranks,
    gameDate: snapshot.profile.gameDate,
    stats: snapshot.profile.stats
  };
}

function getRosterSet() {
  return new Set(slGetSnapshot().roster);
}

function slGetDayOfWeek(month, day) {
  if (typeof window.getSocialLinkDayOfWeek === 'function') {
    return window.getSocialLinkDayOfWeek(month, day);
  }
  const year = month >= 4 ? 2009 : 2010;
  return new Date(year, month - 1, day).getDay();
}

function slResetCalendarWeek() {
  slCalWeekStart = slGetMonday(slState.gameDate);
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
  const link = slGetLink(arcana);
  if (!link || !link.endDate) {
    return false;
  }
  return slCompareDates(slState.gameDate, link.endDate) > 0;
}

function slStatsMet(arcana) {
  const link = slGetLink(arcana);
  if (!link) {
    return false;
  }
  return Object.entries(link.statRequirements).every(
    ([stat, requirement]) => (slState.stats[stat] || 1) >= requirement
  );
}

function slGetBlockedReason(month, day, timeSlot) {
  if (typeof window.getSocialLinkBlockedReason === 'function') {
    return window.getSocialLinkBlockedReason({ month, day }, timeSlot);
  }
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
  const snapshot = slGetSnapshot();
  const results = [];
  ARCANA_LIST.forEach((arcana) => {
    const availability =
      typeof window.getSocialLinkAvailability === 'function'
        ? window.getSocialLinkAvailability(arcana, snapshot, date, timeSlot)
        : null;
    if (!availability || (!availability.available && !availability.actionable)) {
      return;
    }
    const link = availability.link;
    results.push({
      arcana,
      link,
      rank: availability.rank,
      available: availability.available,
      actionable: availability.actionable,
      statsMet: availability.statsMet,
      blocked: ''
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
  const link = slGetLink(arcana);
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

function slBuildGuidePreview(rankData) {
  if (!rankData || !Array.isArray(rankData.answers) || !rankData.answers.length) {
    return '';
  }
  const promptCount = rankData.answers.length;
  const hasBranch = rankData.answers.some((answer) =>
    (answer.options || []).some((option) => option.branchTag)
  );
  return `<div class="sl-rec-answers-preview">Guide: ${promptCount} prompt${
    promptCount === 1 ? '' : 's'
  }${hasBranch ? ' | route split' : ''}</div>`;
}

function slRenderGuideSource(link) {
  if (!link?.guideVersion) {
    return '';
  }
  if (!link.guideSource) {
    return `<div class="sl-persona-reminder sl-answer-source">Verified for ${link.guideVersion}.</div>`;
  }
  return `<div class="sl-persona-reminder sl-answer-source">Verified for ${link.guideVersion}. <a href="${link.guideSource}" target="_blank" rel="noopener noreferrer">Source</a></div>`;
}

function slRenderGuideOption(option) {
  const isBranchOnly = !!option.branchTag && option.points <= 0;
  let optionClass = 'sl-answer-option';
  if (isBranchOnly) {
    optionClass += ' sl-answer-branch';
  } else if (option.points >= 3) {
    optionClass += ' sl-answer-best';
  } else if (option.points === 2) {
    optionClass += ' sl-answer-good';
  } else if (option.points === 1) {
    optionClass += ' sl-answer-neutral';
  } else {
    optionClass += ' sl-answer-bad';
  }
  const pointsHtml = isBranchOnly ? '' : `<span class="sl-pts">+${option.points}</span>`;
  const branchHtml = option.branchTag
    ? `<span class="sl-answer-branch-badge">${option.branchLabel || 'Route split'}</span>`
    : '';
  const noteHtml = option.branchNote ? `<span class="sl-answer-branch-note">${option.branchNote}</span>` : '';
  return `<div class="${optionClass}">${pointsHtml}<span class="sl-answer-text">${option.text}</span>${branchHtml}${noteHtml}</div>`;
}

function slGetHighPressureLinks() {
  const items = [];
  ARCANA_LIST.forEach((arcana) => {
    const link = slGetLink(arcana);
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
    const link = slGetLink(arcana);
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

function slGetAvailabilityState(arcana, date = slState.gameDate, timeSlot = null) {
  return typeof window.getSocialLinkAvailability === 'function'
    ? window.getSocialLinkAvailability(arcana, slGetSnapshot(), date, timeSlot)
    : null;
}

function slGetSlotLabel(timeSlot) {
  return timeSlot === 'evening' ? 'Evening' : 'Daytime';
}

function slFormatAvailableDays(days) {
  if (!Array.isArray(days) || !days.length) {
    return 'story';
  }
  return days.map((day) => DAY_NAMES[day]).join('/');
}

function slGetMissingStats(link) {
  return Object.entries(link?.statRequirements || {})
    .filter(([stat, requirement]) => (slState.stats[stat] || 1) < requirement)
    .map(([stat, requirement]) => ({
      stat,
      current: slState.stats[stat] || 1,
      requirement,
      label: `${SOCIAL_STATS[stat][requirement - 1]} ${stat}`
    }));
}

function slGetDeadlineInfo(link, extra, date = slState.gameDate) {
  if (link?.endDate) {
    const daysLeft = slDaysBetween(date, link.endDate);
    return {
      daysLeft,
      label: daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Last day' : `${daysLeft}d left`,
      isSoon: daysLeft >= 0 && daysLeft <= 45,
      isExpired: daysLeft < 0
    };
  }
  if (extra?.deadline) {
    return {
      daysLeft: null,
      label: extra.deadline,
      isSoon: true,
      isExpired: false
    };
  }
  return {
    daysLeft: null,
    label: '',
    isSoon: false,
    isExpired: false
  };
}

function slIsRareLink(link) {
  return !!link && (!!link.availableDays?.includes(0) || (link.availableDays || []).length <= 2);
}

function slGetChecklistItems(link, rank, availability) {
  const items = [];

  if (link?.unlockDate) {
    items.push({
      label: `Unlock date reached (${slFormatDate(link.unlockDate)})`,
      met: slCompareDates(slState.gameDate, link.unlockDate) >= 0
    });
  }

  Object.entries(link?.statRequirements || {}).forEach(([stat, requirement]) => {
    const current = slState.stats[stat] || 1;
    items.push({
      label: `${SOCIAL_STATS[stat][requirement - 1]} ${stat} (${current}/${requirement})`,
      met: current >= requirement
    });
  });

  (link?.prerequisites || []).forEach((prerequisite) => {
    let met = false;
    if (prerequisite.type === 'started') {
      met = (slState.ranks[prerequisite.arcana] || 0) > 0;
    } else if (prerequisite.type === 'rank') {
      met = (slState.ranks[prerequisite.arcana] || 0) >= prerequisite.minRank;
    }
    items.push({
      label: prerequisite.label || 'Prerequisite required.',
      met
    });
  });

  if (link?.manualUnlock && rank === 0) {
    items.push({
      label: link.setupLabel || `Start ${link.character}.`,
      met: availability?.status !== 'setup_needed'
    });
  }

  return items;
}

function slGetGuideSummaryBits(link) {
  const hasGuide = Array.isArray(link?.ranks) && link.ranks.some((entry) => (entry.answers && entry.answers.length) || entry.note);
  if (!hasGuide) {
    return [];
  }
  const hasRouteSplit = link.ranks.some((entry) =>
    (entry.answers || []).some((answer) => (answer.options || []).some((option) => option.branchTag))
  );
  const bits = ['Guide available'];
  if (hasRouteSplit) {
    bits.push('Route split');
  }
  if (link.guideSource) {
    bits.push('Source linked');
  }
  return bits;
}

function slGetNextStep(model) {
  const { link, availability, missingStats } = model;

  if (!link || link.automatic) {
    return 'Story progression only.';
  }

  if (availability?.available) {
    return `Talk to ${link.character} ${slGetSlotLabel(link.timeSlot).toLowerCase()} at ${link.location}.`;
  }

  if (availability?.status === 'setup_needed') {
    return availability.reason;
  }

  if (availability?.status === 'locked_stats' && missingStats.length) {
    const missing = missingStats[0];
    return `Raise ${missing.stat} to ${missing.requirement} (${missing.label}).`;
  }

  if (availability?.status === 'locked_prerequisite') {
    return availability.reason;
  }

  if (availability?.status === 'before_unlock') {
    return availability.reason;
  }

  if (availability?.status === 'unavailable_weekday') {
    return `Check ${slFormatAvailableDays(link.availableDays)} ${slGetSlotLabel(link.timeSlot).toLowerCase()}.`;
  }

  if (availability?.reason) {
    return availability.reason;
  }

  return `Check ${slFormatAvailableDays(link.availableDays)} ${slGetSlotLabel(link.timeSlot).toLowerCase()}.`;
}

function slGetMyLinksTags(model) {
  const tags = [];
  if (model.actionableToday && !model.availableToday) {
    tags.push('Start today');
  } else if (model.availableToday) {
    tags.push('Available today');
  }
  if (model.deadlineInfo.isSoon) {
    tags.push('Deadline soon');
  }
  if (model.isRare) {
    tags.push('Limited days');
  }
  if (model.missingStats.length) {
    tags.push('Stat gated');
  }
  if (!model.rosterMatch && !model.link.automatic) {
    tags.push('No matching persona');
  }
  return tags;
}

function slBuildLinkModel(arcana, date = slState.gameDate) {
  const link = slGetLink(arcana);
  const rank = slState.ranks[arcana] || 0;
  const extra = slGetLinkExtra(arcana);
  const availability = slGetAvailabilityState(arcana, date, link?.timeSlot || null);
  const scoreResult = slScoreLink(arcana);
  const rosterMatch = slGetRosterMatchForArcana(arcana);
  const missingStats = slGetMissingStats(link);
  const deadlineInfo = slGetDeadlineInfo(link, extra, date);
  const checklist = slGetChecklistItems(link, rank, availability);
  const guideSummaryBits = slGetGuideSummaryBits(link);
  const actionableToday = !!(availability?.available || availability?.actionable);
  const availableToday = !!availability?.available;
  const isRare = slIsRareLink(link);
  const noPersona = !rosterMatch && !link?.automatic;
  const setupNeeded = availability?.status === 'setup_needed';
  const schoolLink = !!link?.schoolLink;
  const sundayLink = !!link?.availableDays?.includes(0);
  const score = Number.isFinite(scoreResult.score) ? scoreResult.score : 0;

  let priority = Math.max(0, score);
  if (actionableToday) {
    priority += availableToday ? 20 : 16;
  }
  if (deadlineInfo.isSoon) {
    priority += 14;
  }
  if (isRare) {
    priority += 8;
  }
  if (rank === 0) {
    priority += 6;
  }
  if (missingStats.length) {
    priority -= 12;
  }
  if (noPersona) {
    priority -= 4;
  }

  const model = {
    arcana,
    link,
    rank,
    extra,
    availability,
    actionableToday,
    availableToday,
    setupNeeded,
    missingStats,
    rosterMatch,
    noPersona,
    deadlineInfo,
    checklist,
    guideSummaryBits,
    isRare,
    schoolLink,
    sundayLink,
    score,
    factors: scoreResult.factors || [],
    priority
  };

  model.nextStep = slGetNextStep(model);
  model.tags = slGetMyLinksTags(model);
  return model;
}

function slGetRecommendationWhy(model) {
  const reasons = [];
  if (model.actionableToday && !model.availableToday) {
    reasons.push('Ready to start right now.');
  } else if (model.availableToday) {
    reasons.push(`Open ${slGetSlotLabel(model.link.timeSlot).toLowerCase()} at ${model.link.location}.`);
  }
  if (model.deadlineInfo.isSoon && model.deadlineInfo.label) {
    reasons.push(model.deadlineInfo.label);
  }
  if (model.isRare) {
    reasons.push(`Only ${model.link.availableDays.length} day${model.link.availableDays.length === 1 ? '' : 's'} each week.`);
  }
  if (model.noPersona) {
    reasons.push(`Bring a ${model.arcana} persona next time.`);
  }
  return reasons.slice(0, 3).join(' ');
}

function slRenderFocusButton(arcana, label = 'Open') {
  return `<button class="sl-mini-action" data-sl-focus="${arcana}">${label}</button>`;
}

function slFocusArcana(arcana) {
  const search = slRoot.querySelector('#sl-links-search');
  const statusFilter = slRoot.querySelector('#sl-filter-status');
  const timeFilter = slRoot.querySelector('#sl-filter-time');
  const sortSelect = slRoot.querySelector('#sl-links-sort');
  if (search) {
    search.value = arcana;
  }
  if (statusFilter) {
    statusFilter.value = '';
  }
  if (timeFilter) {
    timeFilter.value = '';
  }
  if (sortSelect) {
    sortSelect.value = 'urgency';
  }
  slUiState.myLinksChip = '';
  slRoot.querySelectorAll('.sl-filter-chip').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === '');
  });
  slSwitchTab('my-links');
  window.setTimeout(() => {
    const card = slRoot.querySelector(`[data-arcana-card="${arcana}"]`);
    if (!card) {
      return;
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('sl-card-flash');
    window.setTimeout(() => card.classList.remove('sl-card-flash'), 1200);
  }, 0);
}

function slGetModelsForCurrentState() {
  return ARCANA_LIST.map((arcana) => slBuildLinkModel(arcana));
}

function slGetBlockedImportantModel(timeSlot) {
  return slGetModelsForCurrentState()
    .filter(
      (model) =>
        model.link &&
        !model.link.automatic &&
        model.rank < 10 &&
        model.link.timeSlot === timeSlot &&
        !model.actionableToday
    )
    .sort((left, right) => right.priority - left.priority || left.rank - right.rank)
    [0] || null;
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
      const stateLabel = item.actionable && !item.available ? 'Start' : item.arcana;
      return `<div class="sl-action-card"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">${stateLabel}</span></div><div class="sl-action-main">${item.link.character}</div><div class="sl-action-copy">${item.factors.slice(0, 2).join(' • ')}</div>${
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
function slRenderBestUseBoard() {
  const container = slRoot.querySelector('#sl-next-actions');
  if (!container) {
    return;
  }

  const currentDate = slState.gameDate;
  const dayBlocked = slGetBlockedReason(currentDate.month, currentDate.day, 'day');
  const eveningBlocked = slGetBlockedReason(currentDate.month, currentDate.day, 'evening');
  const dayPick = dayBlocked
    ? null
    : slGetRecommendations('day')
        .map((item) => slBuildLinkModel(item.arcana))
        .find((item) => item.score >= 0) || null;
  const eveningPick = eveningBlocked
    ? null
    : slGetRecommendations('evening')
        .map((item) => slBuildLinkModel(item.arcana))
        .find((item) => item.score >= 0) || null;
  const bottlenecks = slGetStatBottlenecks();

  const renderAction = (label, item, blockedReason, statFallback) => {
    if (blockedReason) {
      return `<div class="sl-action-card blocked"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">Blocked</span></div><div class="sl-action-main">${blockedReason}</div></div>`;
    }
    if (item) {
      const stateLabel = item.actionableToday && !item.availableToday ? 'Start' : 'Best today';
      const why = slGetRecommendationWhy(item) || item.factors.slice(0, 2).join(' | ');
      return `<div class="sl-action-card"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">${stateLabel}</span></div><div class="sl-action-main">${item.link.character}</div><div class="sl-action-copy">${why}</div>${
        item.extra?.deadline ? `<div class="sl-action-note">${item.extra.deadline}</div>` : ''
      }<div class="sl-action-cta">${slRenderFocusButton(item.arcana)}</div></div>`;
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
    const link = slGetLink(arcana);
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
    const link = slGetLink(arcana);
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
      const preview = slBuildGuidePreview(nextRankData);
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
      const rankBadge = item.actionable && !item.available ? 'Start' : `Rk ${item.rank}/10`;
      return `<div class="sl-rec-item${isLocked ? ' locked' : ''}"><div class="sl-rec-score">${Math.max(
        0,
        item.score
      )}</div><div class="sl-rec-info"><div><span class="sl-rec-name">${item.link.character}</span><span class="sl-rec-arcana">${item.arcana}</span>${matchBadge}</div><div class="sl-rec-detail">${factorText}</div>${planningLine ? `<div class="sl-rec-planning">${planningLine}</div>` : ''}${preview}</div><div class="sl-rec-rank-badge">${rankBadge}</div></div>`;
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
    const link = slGetLink(arcana);
    const rank = slState.ranks[arcana] || 0;
    const availability =
      typeof window.getSocialLinkAvailability === 'function'
        ? window.getSocialLinkAvailability(arcana, slGetSnapshot(), slState.gameDate, link?.timeSlot || null)
        : null;

    if (statusFilter === 'active' && (rank === 0 || rank >= 10 || link.automatic)) {
      return;
    }
    if (statusFilter === 'maxed' && rank < 10) {
      return;
    }
    if (statusFilter === 'locked' && (rank > 0 || link.automatic)) {
      return;
    }
    if (statusFilter === 'unavailable' && (availability?.available || availability?.actionable)) {
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
    if (!link.automatic && availability) {
      const statusText = availability.available
        ? 'Available today'
        : availability.status === 'setup_needed'
          ? 'Ready to start'
          : availability.reason;
      metaHtml += `<span class="sl-meta-badge sl-meta-status${
        availability.available || availability.actionable ? ' available' : ''
      }">${statusText}</span>`;
    }
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
    if (!link.automatic && link.ranks.some((entry) => (entry.answers && entry.answers.length) || entry.note)) {
      const sourceLine = slRenderGuideSource(link);
      answerHtml = `<button class="sl-expand-btn" data-arcana="${arcana}"><span class="sl-expand-arrow">&#9654;</span> Answer Guide</button><div class="sl-answer-guide"><div class="sl-persona-reminder">&#9733; Carry a ${arcana} Persona for +1 bonus points per answer</div>${sourceLine}`;
      link.ranks.forEach((entry) => {
        if (!entry.answers || !entry.answers.length) {
          if (entry.note) {
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
              answerHtml += slRenderGuideOption(option);
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
  const snapshot = slGetSnapshot();
  const results = [];
  ARCANA_LIST.forEach((arcana) => {
    const availability =
      typeof window.getSocialLinkAvailability === 'function'
        ? window.getSocialLinkAvailability(arcana, snapshot, date, timeSlot)
        : null;
    if (!availability || (!availability.available && !availability.actionable)) {
      return;
    }
    results.push({
      arcana,
      character: availability.link.character,
      rank: availability.rank,
      available: availability.available,
      actionable: availability.actionable,
      statsMet: availability.statsMet,
      maxed: availability.rank >= 10
    });
  });
  return results;
}

function slCalLinkHtml(item, timeSlot) {
  let cssClass = 'sl-cal-link';
  if (!item.statsMet || item.maxed) {
    cssClass += ' locked';
  }
  const rankLabel = item.actionable && !item.available ? 'Start' : item.maxed ? 'MAX' : item.rank;
  return `<div class="${cssClass}"><span class="sl-cal-link-dot ${timeSlot}"></span><span class="sl-cal-link-name">${item.character}</span><span class="sl-cal-link-rank">${rankLabel}</span></div>`;
}

function slRenderCalendar() {
  if (!slCalWeekStart) {
    slResetCalendarWeek();
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

function slRenderBestUseBoard() {
  const container = slRoot.querySelector('#sl-next-actions');
  if (!container) {
    return;
  }

  const currentDate = slState.gameDate;
  const dayBlocked = slGetBlockedReason(currentDate.month, currentDate.day, 'day');
  const eveningBlocked = slGetBlockedReason(currentDate.month, currentDate.day, 'evening');
  const dayPick = dayBlocked
    ? null
    : slGetRecommendations('day')
        .map((item) => slBuildLinkModel(item.arcana))
        .find((item) => item.score >= 0) || null;
  const eveningPick = eveningBlocked
    ? null
    : slGetRecommendations('evening')
        .map((item) => slBuildLinkModel(item.arcana))
        .find((item) => item.score >= 0) || null;
  const bottlenecks = slGetStatBottlenecks();

  const renderAction = (label, item, blockedReason, statFallback) => {
    if (blockedReason) {
      return `<div class="sl-action-card blocked"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">Blocked</span></div><div class="sl-action-main">${blockedReason}</div></div>`;
    }
    if (item) {
      const stateLabel = item.actionableToday && !item.availableToday ? 'Start' : 'Best today';
      const why = slGetRecommendationWhy(item) || item.factors.slice(0, 2).join(' | ');
      return `<div class="sl-action-card"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">${stateLabel}</span></div><div class="sl-action-main">${item.link.character}</div><div class="sl-action-copy">${why}</div>${
        item.extra?.deadline ? `<div class="sl-action-note">${item.extra.deadline}</div>` : ''
      }<div class="sl-action-cta">${slRenderFocusButton(item.arcana)}</div></div>`;
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

  const items = slGetModelsForCurrentState()
    .filter((model) => !model.link.automatic && model.rank < 10 && (model.deadlineInfo.isSoon || model.isRare || model.missingStats.length))
    .sort((left, right) => right.priority - left.priority || left.rank - right.rank);

  if (!items.length) {
    container.innerHTML = '<div class="sl-rec-empty">No route looks especially fragile from your current date and ranks.</div>';
    return;
  }

  const actionable = items.filter((item) => item.actionableToday).slice(0, 3);
  const blocked = items.filter((item) => !item.actionableToday).slice(0, 3);

  const renderGroup = (title, entries) => {
    if (!entries.length) {
      return `<div class="sl-risk-group"><h3>${title}</h3><div class="sl-rec-empty">Nothing in this bucket right now.</div></div>`;
    }
    return `<div class="sl-risk-group"><h3>${title}</h3>${entries
      .map((item) => {
        const reasons = [];
        if (item.deadlineInfo.isSoon && item.deadlineInfo.label) {
          reasons.push(item.deadlineInfo.label);
        }
        if (item.isRare) {
          reasons.push('limited days');
        }
        if (item.missingStats.length) {
          reasons.push(`${item.missingStats[0].stat} gate`);
        }
        return `<div class="sl-risk-item"><div class="sl-risk-top"><span class="sl-risk-name">${item.link.character}</span><span class="sl-risk-arcana">${item.arcana}</span></div><div class="sl-risk-copy">${reasons.join(' | ') || item.nextStep}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
      })
      .join('')}</div>`;
  };

  container.innerHTML = renderGroup('Can still act', actionable) + renderGroup('Blocked by stats/setup', blocked);
}

function slRenderUnlockNext() {
  const container = slRoot.querySelector('#sl-unlock-next');
  if (!container) {
    return;
  }

  const items = slGetModelsForCurrentState()
    .filter((model) => !model.link.automatic && model.rank === 0)
    .map((model) => {
      const unmetCount = model.checklist.filter((entry) => !entry.met).length;
      const daysUntilUnlock =
        slCompareDates(slState.gameDate, model.link.unlockDate) < 0
          ? slDaysBetween(slState.gameDate, model.link.unlockDate)
          : 0;
      return {
        ...model,
        unlockDistance: Math.max(0, daysUntilUnlock) + unmetCount * 8 + model.missingStats.length * 6
      };
    })
    .sort((left, right) => left.unlockDistance - right.unlockDistance || right.priority - left.priority)
    .slice(0, 3);

  if (!items.length) {
    container.innerHTML = '<div class="sl-rec-empty">Every manual link is already started or maxed.</div>';
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const remaining = item.checklist
        .filter((entry) => !entry.met)
        .slice(0, 3)
        .map((entry) => entry.label)
        .join(' | ');
      return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.link.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">${item.actionableToday ? 'Start today' : item.nextStep}</div><div class="sl-focus-note">${remaining || 'Everything is in place.'}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
    })
    .join('');
}

function slRenderPremiumWeek() {
  const container = slRoot.querySelector('#sl-premium-week');
  if (!container) {
    return;
  }

  const weekStart = slGetMonday(slState.gameDate);
  const premiumItems = [];

  for (let index = 0; index < 7; index += 1) {
    const date = slAdvanceDate(weekStart, index);
    ['day', 'evening'].forEach((timeSlot) => {
      slGetCalLinks(date, null, timeSlot)
        .filter((item) => item.isRare || item.deadlineInfo.isSoon)
        .slice(0, 2)
        .forEach((item) => {
          premiumItems.push({
            ...item,
            date,
            timeSlot
          });
        });
    });
  }

  premiumItems.sort((left, right) => slCompareDates(left.date, right.date) || right.priority - left.priority);

  if (!premiumItems.length) {
    container.innerHTML = '<div class="sl-rec-empty">No especially scarce social link slots show up this week.</div>';
    return;
  }

  container.innerHTML = premiumItems
    .slice(0, 5)
    .map((item) => {
      const tags = [];
      if (item.isRare) {
        tags.push('Rare slot');
      }
      if (item.deadlineInfo.isSoon && item.deadlineInfo.label) {
        tags.push(item.deadlineInfo.label);
      }
      return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.link.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">${slFormatDate(item.date)} | ${slGetSlotLabel(item.timeSlot)}</div><div class="sl-focus-note">${tags.join(' | ') || item.nextStep}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
    })
    .join('');
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

  const recommendations = slGetRecommendations(timeSlot).map((item) => slBuildLinkModel(item.arcana));
  if (recommendations.length === 0) {
    container.innerHTML = `<div class="sl-rec-empty">No social links available for this ${timeSlot} slot on ${slFormatDate(
      slState.gameDate
    )}.</div>`;
    return;
  }

  const limit = timeSlot === 'day' ? 3 : 2;
  const primary = recommendations[0];
  const backups = recommendations.slice(1, limit);
  const blockedImportant = slGetBlockedImportantModel(timeSlot);

  const renderTags = (tags) =>
    tags.length
      ? `<div class="sl-rec-tags">${tags.map((tag) => `<span class="sl-rec-tag">${tag}</span>`).join('')}</div>`
      : '';

  const primaryNextRank = primary.link.ranks
    ? primary.link.ranks.find((rankEntry) => rankEntry.rank === primary.rank + 1)
    : null;

  let html = `<section class="sl-rec-primary"><div class="sl-rec-header"><span class="sl-rec-kicker">Best today</span><span class="sl-rec-secondary">Score ${Math.max(
    0,
    primary.score
  )}</span></div><div class="sl-rec-primary-name-row"><span class="sl-rec-name">${primary.link.character}</span><span class="sl-rec-arcana">${primary.arcana}</span></div>${renderTags(
    primary.tags.slice(0, 4)
  )}<div class="sl-rec-why">${slGetRecommendationWhy(primary) || primary.factors.slice(0, 2).join(' | ')}</div>${
    primary.rosterMatch
      ? `<div class="sl-rec-planning">Matching persona: ${primary.rosterMatch}</div>`
      : '<div class="sl-rec-planning">No matching persona in roster.</div>'
  }${slBuildGuidePreview(primaryNextRank)}<div class="sl-rec-actions">${slRenderFocusButton(primary.arcana)}</div></section>`;

  if (backups.length) {
    html += `<section class="sl-rec-group"><h3>Good backup</h3>${backups
      .map((item) => {
        const nextRankData = item.link.ranks
          ? item.link.ranks.find((rankEntry) => rankEntry.rank === item.rank + 1)
          : null;
        return `<div class="sl-rec-item"><div class="sl-rec-info"><div class="sl-rec-name-row"><span class="sl-rec-name">${item.link.character}</span><span class="sl-rec-arcana">${item.arcana}</span></div>${renderTags(
          item.tags.slice(0, 3)
        )}<div class="sl-rec-detail">${slGetRecommendationWhy(item) || item.factors.slice(0, 2).join(' | ')}</div>${slBuildGuidePreview(
          nextRankData
        )}</div><div class="sl-rec-side"><span class="sl-rec-rank-badge">${
          item.actionableToday && !item.availableToday ? 'Start' : `Rk ${item.rank}/10`
        }</span>${slRenderFocusButton(item.arcana)}</div></div>`;
      })
      .join('')}</section>`;
  }

  if (blockedImportant) {
    html += `<section class="sl-rec-group"><h3>Blocked but important</h3><div class="sl-rec-item blocked-callout"><div class="sl-rec-info"><div class="sl-rec-name-row"><span class="sl-rec-name">${blockedImportant.link.character}</span><span class="sl-rec-arcana">${blockedImportant.arcana}</span></div>${renderTags(
      blockedImportant.tags.slice(0, 3)
    )}<div class="sl-rec-detail">${blockedImportant.nextStep}</div></div><div class="sl-rec-side">${slRenderFocusButton(
      blockedImportant.arcana,
      'Open link'
    )}</div></div></section>`;
  }

  container.innerHTML = html;
}

function slRenderDashboard() {
  slRenderStatusBar();
  slRenderProgressGrid();
  slRenderRecommendations();
  slRenderBestUseBoard();
  slRenderRiskBoard();
  slRenderUnlockNext();
  slRenderPremiumWeek();
  slRenderPlanningInsights();
}

function slRenderMyLinks() {
  const grid = slRoot.querySelector('#sl-links-grid');
  if (!grid) {
    return;
  }

  const searchQuery = (slRoot.querySelector('#sl-links-search')?.value || '').trim().toLowerCase();
  const sortMode = slRoot.querySelector('#sl-links-sort')?.value || 'urgency';
  const statusFilter = slRoot.querySelector('#sl-filter-status')?.value || '';
  const timeFilter = slRoot.querySelector('#sl-filter-time')?.value || '';
  const chipFilter = slUiState.myLinksChip || '';

  const models = slGetModelsForCurrentState()
    .filter((model) => {
      const { link, rank, availability } = model;

      if (statusFilter === 'active' && (rank === 0 || rank >= 10 || link.automatic)) {
        return false;
      }
      if (statusFilter === 'maxed' && rank < 10) {
        return false;
      }
      if (statusFilter === 'locked' && (rank > 0 || link.automatic)) {
        return false;
      }
      if (statusFilter === 'unavailable' && (availability?.available || availability?.actionable)) {
        return false;
      }
      if (timeFilter && link.timeSlot !== timeFilter) {
        return false;
      }
      if (searchQuery) {
        const haystack = `${link.character} ${model.arcana}`.toLowerCase();
        if (!haystack.includes(searchQuery)) {
          return false;
        }
      }
      if (chipFilter === 'actionable' && !model.actionableToday) {
        return false;
      }
      if (chipFilter === 'setup' && !model.setupNeeded) {
        return false;
      }
      if (chipFilter === 'deadline' && !model.deadlineInfo.isSoon) {
        return false;
      }
      if (chipFilter === 'stat-gated' && !model.missingStats.length) {
        return false;
      }
      if (chipFilter === 'no-persona' && !model.noPersona) {
        return false;
      }
      if (chipFilter === 'school' && !model.schoolLink) {
        return false;
      }
      if (chipFilter === 'sunday' && !model.sundayLink) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      if (sortMode === 'today') {
        return Number(right.actionableToday) - Number(left.actionableToday) || right.priority - left.priority;
      }
      if (sortMode === 'rank-asc') {
        return left.rank - right.rank || left.link.character.localeCompare(right.link.character);
      }
      if (sortMode === 'rank-desc') {
        return right.rank - left.rank || left.link.character.localeCompare(right.link.character);
      }
      if (sortMode === 'alpha') {
        return left.link.character.localeCompare(right.link.character);
      }
      return right.priority - left.priority || left.link.character.localeCompare(right.link.character);
    });

  let html = '';
  models.forEach((model) => {
    const { arcana, link, rank, availability } = model;
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
      metaHtml += `<span class="sl-meta-badge sl-meta-time-${link.timeSlot}">${slGetSlotLabel(link.timeSlot)}</span>`;
    }
    metaHtml += `<span class="sl-meta-badge sl-meta-unlock">Unlocks ${slFormatDate(link.unlockDate)}</span>`;
    if (!link.automatic && availability) {
      const statusText = model.availableToday
        ? 'Available today'
        : model.setupNeeded
          ? 'Ready to start'
          : availability.reason;
      metaHtml += `<span class="sl-meta-badge sl-meta-status${
        model.actionableToday ? ' available' : ''
      }">${statusText}</span>`;
    }
    Object.entries(link.statRequirements).forEach(([stat, requirement]) => {
      const met = (slState.stats[stat] || 1) >= requirement;
      metaHtml += `<span class="sl-meta-badge sl-meta-stat${met ? '' : ' unmet'}">${SOCIAL_STATS[stat][requirement - 1]} ${stat}${met ? ' OK' : ' Locked'}</span>`;
    });

    const tagRow = model.tags.length
      ? `<div class="sl-card-tags">${model.tags.map((tag) => `<span class="sl-card-tag">${tag}</span>`).join('')}</div>`
      : '';

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
    if (!link.automatic && link.ranks.some((entry) => (entry.answers && entry.answers.length) || entry.note)) {
      const sourceLine = slRenderGuideSource(link);
      const summaryLine = model.guideSummaryBits.length
        ? `<div class="sl-guide-summary">${model.guideSummaryBits.join(' | ')}</div>`
        : '';
      answerHtml = `<button class="sl-expand-btn" data-arcana="${arcana}"><span class="sl-expand-arrow">&#9654;</span> Answer Guide</button>${summaryLine}<div class="sl-answer-guide"><div class="sl-persona-reminder">Carry a ${arcana} Persona for +1 bonus points per answer</div>${sourceLine}`;
      link.ranks.forEach((entry) => {
        if (!entry.answers || !entry.answers.length) {
          if (entry.note) {
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
              answerHtml += slRenderGuideOption(option);
            });
          answerHtml += '</div>';
        });
        answerHtml += '</div>';
      });
      answerHtml += '</div>';
    }

    let checklistHtml = '';
    const checklistItems = model.checklist.filter((entry) => !!entry.label);
    if (checklistItems.length && (rank === 0 || model.missingStats.length || availability?.status === 'locked_prerequisite')) {
      checklistHtml = `<details class="sl-checklist"><summary>Prerequisites / unlock checklist</summary><div class="sl-checklist-body">${checklistItems
        .map(
          (entry) =>
            `<div class="sl-checklist-item${entry.met ? ' met' : ''}"><span class="sl-checklist-state">${entry.met ? 'Met' : 'Open'}</span><span>${entry.label}</span></div>`
        )
        .join('')}</div></details>`;
    }

    const extra = model.extra;
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

    html += `<div class="${cssClass}" data-arcana-card="${arcana}"><div class="sl-link-card-header"><span class="sl-link-card-title">${link.character}</span><span class="sl-link-card-arcana">${arcana}</span></div>${tagRow}<div class="sl-link-card-desc">${link.description}</div><div class="sl-link-card-meta">${metaHtml}</div><div class="sl-next-step-row"><span class="sl-next-step-label">Next step</span><span class="sl-next-step-copy">${model.nextStep}</span></div>${extraHtml}<div class="sl-days-row">${daysHtml}</div>${rankHtml}${checklistHtml}${answerHtml}</div>`;
  });

  grid.innerHTML = html || '<div class="sl-rec-empty">No links match the current filters.</div>';
}

function slGetCalLinks(date, dayOfWeek, timeSlot) {
  const results = [];
  ARCANA_LIST.forEach((arcana) => {
    const availability = slGetAvailabilityState(arcana, date, timeSlot);
    if (!availability || (!availability.available && !availability.actionable)) {
      return;
    }
    const model = slBuildLinkModel(arcana, date);
    results.push({
      ...model,
      rank: availability.rank,
      available: availability.available,
      actionable: availability.actionable,
      statsMet: availability.statsMet,
      maxed: availability.rank >= 10
    });
  });

  const mode = slUiState.calendarMode || 'all';
  const filtered = results.filter((item) => {
    if (mode === 'urgent') {
      return item.deadlineInfo.isSoon || item.isRare || item.rank === 0;
    }
    if (mode === 'actionable') {
      return item.available || item.actionable;
    }
    return true;
  });

  return filtered.sort((left, right) => right.priority - left.priority || left.link.character.localeCompare(right.link.character));
}

function slCalLinkHtml(item, timeSlot) {
  let cssClass = 'sl-cal-link';
  if (!item.statsMet || item.maxed) {
    cssClass += ' locked';
  }
  if (item.isRare || item.deadlineInfo.isSoon) {
    cssClass += ' premium';
  }
  const rankLabel = item.actionable && !item.available ? 'Start' : item.maxed ? 'MAX' : item.rank;
  const flagText = item.deadlineInfo.isSoon
    ? item.deadlineInfo.label
    : item.isRare
      ? 'Rare'
      : '';
  return `<div class="${cssClass}"><span class="sl-cal-link-dot ${timeSlot}"></span><span class="sl-cal-link-name">${item.link.character}</span><span class="sl-cal-link-rank">${rankLabel}</span>${flagText ? `<span class="sl-cal-link-flag">${flagText}</span>` : ''}</div>`;
}

function slRenderCalendar() {
  if (!slCalWeekStart) {
    slResetCalendarWeek();
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
    const dayLinks = blockedDay ? [] : slGetCalLinks(date, dayOfWeek, 'day');
    const eveningLinks = blockedEvening ? [] : slGetCalLinks(date, dayOfWeek, 'evening');
    const premiumDay = [...dayLinks, ...eveningLinks].some((item) => item.isRare || item.deadlineInfo.isSoon);

    let cssClass = 'sl-cal-day';
    if (isToday) {
      cssClass += ' today';
    }
    if (blockedDay && blockedEvening) {
      cssClass += ' blocked';
    }

    html += `<div class="${cssClass}"><div class="sl-cal-day-header"><span class="sl-cal-day-name">${DAY_NAMES[dayOfWeek]}</span><span class="sl-cal-day-date">${slFormatDate(
      date
    )}</span></div><div class="sl-cal-day-summary"><span>${dayLinks.length} day</span><span>${eveningLinks.length} eve</span>${
      premiumDay ? '<span class="sl-cal-day-premium">Rare slot</span>' : ''
    }</div>`;

    if (blockedDay && blockedEvening) {
      html += `<div class="sl-cal-blocked-label">${blockedDay || blockedEvening}</div>`;
    } else if (blockedDay) {
      html += `<div class="sl-cal-blocked-label">Day: ${blockedDay}</div>`;
    } else if (blockedEvening) {
      html += `<div class="sl-cal-blocked-label">Eve: ${blockedEvening}</div>`;
    }

    html += '<div class="sl-cal-links">';
    if (!blockedDay) {
      html += '<div class="sl-cal-slot"><div class="sl-cal-slot-label">Day</div>';
      dayLinks.forEach((item) => {
        html += slCalLinkHtml(item, 'day');
      });
      if (!dayLinks.length) {
        html += '<div class="sl-cal-empty">No daytime picks</div>';
      }
      html += '</div>';
    }
    if (!blockedEvening) {
      html += '<div class="sl-cal-slot"><div class="sl-cal-slot-label">Evening</div>';
      eveningLinks.forEach((item) => {
        html += slCalLinkHtml(item, 'evening');
      });
      if (!eveningLinks.length) {
        html += '<div class="sl-cal-empty">No evening picks</div>';
      }
      html += '</div>';
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
    slResetCalendarWeek();
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

  slRoot.addEventListener('click', (event) => {
    const focusButton = event.target.closest('[data-sl-focus]');
    if (focusButton) {
      slFocusArcana(focusButton.dataset.slFocus);
      return;
    }

    const chip = event.target.closest('.sl-filter-chip');
    if (chip) {
      slUiState.myLinksChip = chip.dataset.filter || '';
      slRoot.querySelectorAll('.sl-filter-chip').forEach((button) => {
        button.classList.toggle('active', button === chip);
      });
      slRenderMyLinks();
      return;
    }

    const calendarMode = event.target.closest('.sl-cal-mode-btn');
    if (calendarMode) {
      slUiState.calendarMode = calendarMode.dataset.mode || 'all';
      slRoot.querySelectorAll('.sl-cal-mode-btn').forEach((button) => {
        button.classList.toggle('active', button === calendarMode);
      });
      slRenderCalendar();
    }
  });

  slRoot.querySelector('#sl-links-search')?.addEventListener('input', slRenderMyLinks);
  slRoot.querySelector('#sl-links-sort')?.addEventListener('change', slRenderMyLinks);
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
