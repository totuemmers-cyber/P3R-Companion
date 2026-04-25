(() => {
let slRoot;
let slStore;
let slState = null;
let slCalWeekStart = null;
let slFusionCache = null;
let slCompletionCache = new Map();
let slLastDateKey = '';
let slLastStateKey = '';
let initialized = false;
let renderQueued = false;
const SL_COMPLETION_FINAL_DATE = { month: 1, day: 30 };
const SL_COMPLETION_REWARD = 'Orpheus Telos';
const slUiState = {
  myLinksChip: '',
  calendarMode: 'all',
  focusMode: 'balanced'
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
  const stateKey = JSON.stringify({
    date: snapshot.profile.gameDate,
    stats: snapshot.profile.stats,
    ranks: snapshot.socialLinks.ranks
  });
  if (slLastDateKey && slLastDateKey !== dateKey) {
    slCalWeekStart = slGetMonday(snapshot.profile.gameDate);
  }
  slLastDateKey = dateKey;
  if (slLastStateKey !== stateKey) {
    slCompletionCache = new Map();
    slLastStateKey = stateKey;
  }
  slState = {
    ranks: snapshot.socialLinks.ranks,
    gameDate: snapshot.profile.gameDate,
    stats: snapshot.profile.stats
  };
}

function slIsCompletionFocus() {
  return slUiState.focusMode === 'completion';
}

function slGetFocusMode() {
  return slIsCompletionFocus() ? 'completion' : 'balanced';
}

function slGetAdvisor() {
  return window.socialLinkAdvisor;
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
    results.push({
      arcana,
      link: availability.link,
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

  const fusionScore = Math.round((fusion.pairs / 12) * 4);
  const personaBonus = Math.round((fusion.personas / 12) * 3);
  score += fusionScore + personaBonus;
  if (fusionScore >= 3) {
    factors.push(`High fusion value (${fusion.pairs} recipe pairs)`);
  }
  if (personaBonus >= 2) {
    factors.push(`${fusion.personas} personas in this arcana`);
  }

  if (link.endDate) {
    const daysLeft = slDaysBetween(slState.gameDate, link.endDate);
    if (daysLeft > 0 && daysLeft <= 30) {
      const urgency = Math.round(4 * (1 - daysLeft / 30));
      score += urgency;
      factors.push(`Window closing in ~${daysLeft} days`);
    } else if (daysLeft <= 0) {
      score -= 100;
      factors.push('EXPIRED');
    }
  }

  if (link.availableDays.length > 0 && link.availableDays.length <= 2) {
    score += link.availableDays.length === 1 ? 4 : 3;
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

  if (link.timeSlot === 'evening') {
    score += 1;
    factors.push('Evening slot (does not use daytime)');
  }

  const rosterMatch = slGetRosterMatchForArcana(arcana);
  const roster = getRosterSet();
  if (rosterMatch) {
    score += 2;
    factors.push(`Have ${rosterMatch} for arcana bonus`);
  } else if (roster.size > 0) {
    score -= 1;
    factors.push(`No ${arcana} persona in roster`);
  }

  return { score, factors };
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

function slGetStatBottlenecks() {
  return slGetAdvisor().getStatBottlenecks(slGetSnapshot());
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

function slGetPlanningEndDate(link) {
  if (!link?.endDate) {
    return SL_COMPLETION_FINAL_DATE;
  }
  return slCompareDates(link.endDate, SL_COMPLETION_FINAL_DATE) <= 0 ? link.endDate : SL_COMPLETION_FINAL_DATE;
}

function slEstimateRemainingOpportunities(arcana, link, startDate = slState.gameDate) {
  const rank = slState.ranks[arcana] || 0;
  if (!link || link.automatic || rank >= 10) {
    return 0;
  }

  const endDate = slGetPlanningEndDate(link);
  const firstDate =
    link.unlockDate && slCompareDates(startDate, link.unlockDate) < 0 ? link.unlockDate : startDate;
  if (slCompareDates(firstDate, endDate) > 0) {
    return 0;
  }

  const cacheKey = `${arcana}|${firstDate.month}/${firstDate.day}`;
  if (slCompletionCache.has(cacheKey)) {
    return slCompletionCache.get(cacheKey);
  }

  let count = 0;
  let cursor = firstDate;
  while (slCompareDates(cursor, endDate) <= 0) {
    const availability = slGetAvailabilityState(arcana, cursor, link.timeSlot || null);
    if (availability && (availability.available || availability.actionable)) {
      count += 1;
    }
    cursor = slAdvanceDate(cursor, 1);
  }

  slCompletionCache.set(cacheKey, count);
  return count;
}

function slGetCompletionMetrics({
  arcana,
  link,
  rank,
  availability,
  missingStats,
  isRare,
  setupNeeded,
  deadlineInfo,
  date = slState.gameDate
}) {
  const planningEndDate = slGetPlanningEndDate(link);
  const requiredSlots = link?.automatic ? 0 : Math.max(0, 10 - rank);
  const remainingWindows = slEstimateRemainingOpportunities(arcana, link, date);
  const daysUntilUnlock =
    link?.unlockDate && slCompareDates(date, link.unlockDate) < 0 ? slDaysBetween(date, link.unlockDate) : 0;
  const slack = remainingWindows - requiredSlots;
  const actionableNow = !!(availability?.available || availability?.actionable);

  let pressure = requiredSlots * 5;
  if (deadlineInfo.isExpired) {
    pressure += 100;
  } else if (slack < 0) {
    pressure += 70 + Math.abs(slack) * 14;
  } else if (slack <= 1) {
    pressure += 42;
  } else if (slack <= 3) {
    pressure += 28;
  } else if (slack <= 6) {
    pressure += 14;
  }

  if (daysUntilUnlock > 0) {
    pressure += Math.max(0, 18 - Math.min(daysUntilUnlock, 18));
  }
  if (isRare) {
    pressure += 12;
  }
  if (deadlineInfo.isSoon) {
    pressure += 10;
  }
  if (setupNeeded) {
    pressure += 16;
  }
  if (missingStats.length) {
    pressure += 20;
  }
  if (availability?.status === 'locked_prerequisite') {
    pressure += 18;
  }
  if (!actionableNow && (slack <= 2 || setupNeeded || missingStats.length)) {
    pressure += 8;
  }

  const criticalPath =
    !link?.automatic &&
    rank < 10 &&
    (deadlineInfo.isExpired ||
      slack <= 2 ||
      (daysUntilUnlock > 0 && remainingWindows <= requiredSlots + 2) ||
      (isRare && slack <= 4) ||
      ((missingStats.length || setupNeeded || availability?.status === 'locked_prerequisite') &&
        remainingWindows <= requiredSlots + 4));

  let state = 'safe';
  if (rank >= 10 || link?.automatic) {
    state = 'done';
  } else if (deadlineInfo.isExpired || slack < 0) {
    state = 'missed';
  } else if (!actionableNow && criticalPath) {
    state = 'blocked';
  } else if (slack <= 0) {
    state = 'must_act_now';
  } else if (slack <= 2) {
    state = 'tight';
  } else if (slack <= 6) {
    state = 'watch';
  }

  return {
    reward: SL_COMPLETION_REWARD,
    planningEndDate,
    requiredSlots,
    remainingWindows,
    slack,
    daysUntilUnlock,
    pressure,
    criticalPath,
    actionableNow,
    state
  };
}

function slEstimateRemainingTimeSlots(startDate = slState.gameDate, endDate = SL_COMPLETION_FINAL_DATE) {
  const manualLinks = ARCANA_LIST
    .map((arcana) => ({
      arcana,
      link: slGetLink(arcana),
      rank: slState.ranks[arcana] || 0
    }))
    .filter(({ link, rank }) => link && !link.automatic && rank < 10);

  const totals = {
    day: 0,
    evening: 0,
    either: 0
  };

  if (!manualLinks.length || slCompareDates(startDate, endDate) > 0) {
    return totals;
  }

  let cursor = startDate;
  while (slCompareDates(cursor, endDate) <= 0) {
    let hasAny = false;
    ['day', 'evening'].forEach((timeSlot) => {
      if (slGetBlockedReason(cursor.month, cursor.day, timeSlot)) {
        return;
      }
      const open = manualLinks.some(({ arcana, link }) => {
        if (link.timeSlot !== timeSlot) {
          return false;
        }
        const availability = slGetAvailabilityState(arcana, cursor, timeSlot);
        return availability && (availability.available || availability.actionable);
      });
      if (open) {
        totals[timeSlot] += 1;
        hasAny = true;
      }
    });
    if (hasAny) {
      totals.either += 1;
    }
    cursor = slAdvanceDate(cursor, 1);
  }

  return totals;
}

function slGetTodayPriority({
  availableToday,
  actionableToday,
  deadlineInfo,
  isRare,
  link,
  noPersona,
  setupNeeded,
  completion,
  score
}) {
  if (!actionableToday) {
    return -500 + Math.max(0, completion.pressure);
  }

  let total = 220 + Math.max(0, completion.pressure) * 3;
  const availableDayCount = Array.isArray(link?.availableDays) && link.availableDays.length ? link.availableDays.length : 6;

  if (completion.slack < 0) {
    total += 120;
  } else if (completion.slack <= 0) {
    total += 92;
  } else if (completion.slack <= 2) {
    total += 68;
  } else if (completion.slack <= 4) {
    total += 38;
  } else if (completion.slack <= 8) {
    total += 16;
  }

  if (deadlineInfo.isSoon) {
    total += typeof deadlineInfo.daysLeft === 'number'
      ? Math.max(12, 36 - Math.min(deadlineInfo.daysLeft, 24))
      : 18;
  }

  if (isRare) {
    if (availableDayCount === 1) {
      total += 28;
    } else if (availableDayCount === 2) {
      total += 22;
    } else {
      total += 14;
    }
  }

  if (setupNeeded) {
    total -= 6;
  }
  if (noPersona) {
    total -= 2;
  }

  return total + Math.min(8, Math.max(0, Math.round(score / 2)));
}

function slGetWeeklyPressure({ deadlineInfo, isRare, rank, missingStats, setupNeeded, actionableToday, completion, link }) {
  let total = Math.max(0, completion.pressure);
  const availableDayCount = Array.isArray(link?.availableDays) && link.availableDays.length ? link.availableDays.length : 6;

  if (deadlineInfo.isSoon) {
    if (typeof deadlineInfo.daysLeft === 'number') {
      total += Math.max(12, 34 - Math.min(deadlineInfo.daysLeft, 22));
    } else {
      total += 18;
    }
  }
  if (isRare) {
    total += availableDayCount === 1 ? 22 : availableDayCount === 2 ? 18 : 10;
  }
  if (rank === 0) {
    total += 8;
  }
  if (completion.slack <= 2) {
    total += 26;
  } else if (completion.slack <= 4) {
    total += 14;
  }
  if (missingStats.length) {
    total += completion.criticalPath ? 16 : 10;
  }
  if (setupNeeded) {
    total += completion.criticalPath ? 14 : 8;
  }
  if (!actionableToday) {
    total += 6;
  }

  return total;
}

function slGetMyLinksTags(model) {
  if (slIsCompletionFocus()) {
    const tags = [];
    if (model.completion.criticalPath) {
      tags.push('Critical path');
    }
    if (model.completion.state === 'must_act_now') {
      tags.push(model.actionableToday ? 'Must rank today' : 'Must start now');
    } else if (model.completion.state === 'blocked') {
      tags.push('Blocked critical');
    } else if (model.completion.state === 'tight') {
      tags.push('Tight schedule');
    } else if (model.completion.state === 'watch') {
      tags.push('Watch closely');
    } else if (model.completion.state === 'safe') {
      tags.push('Safe to delay');
    }
    if (model.setupNeeded) {
      tags.push('Needs setup');
    }
    if (model.missingStats.length) {
      tags.push('Stat gated');
    }
    if (!model.rosterMatch && !model.link.automatic) {
      tags.push('No matching persona');
    }
    return [...new Set(tags)].slice(0, 4);
  }

  const tags = [];

  if (model.actionableToday && !model.availableToday) {
    tags.push('Start today');
  } else if (model.availableToday) {
    tags.push('Available today');
  }

  if (model.completion.slack <= 2) {
    tags.push('Tight schedule');
  } else if (model.completion.slack >= 8 && !model.deadlineInfo.isSoon && !model.isRare) {
    tags.push('Safe to delay');
  }

  if (!model.actionableToday && (model.isRare || model.deadlineInfo.isSoon)) {
    tags.push('Watch later this week');
  } else if (model.isRare) {
    tags.push('Rare slot');
  }

  if (model.deadlineInfo.isSoon) {
    tags.push(model.actionableToday ? 'Deadline pressure' : 'Deadline this week');
  }
  if (model.setupNeeded) {
    tags.push('Needs setup');
  }
  if (model.missingStats.length) {
    tags.push('Stat gated');
  }
  if (!model.rosterMatch && !model.link.automatic) {
    tags.push('No matching persona');
  }

  return [...new Set(tags)].slice(0, 4);
}

function slBuildLinkModel(arcana, date = slState.gameDate) {
  return slGetAdvisor().getModel(slGetSnapshot(), {
    arcana,
    date,
    focusMode: slGetFocusMode()
  });
}

function slGetPriorityValue(model) {
  return slIsCompletionFocus() ? model.completion.pressure : model.todayPriority;
}

function slCompareModels(left, right) {
  return slGetAdvisor().compareModels(left, right, { focusMode: slGetFocusMode() });
}

function slGetRecommendationWhy(model) {
  return slGetAdvisor().getRecommendationWhy(model, { focusMode: slGetFocusMode() });
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
  return slGetAdvisor().getModels(slGetSnapshot(), {
    date: slState.gameDate,
    focusMode: slGetFocusMode()
  });
}

function slGetActionableModels(date = slState.gameDate, timeSlot = 'day') {
  return slGetAdvisor().getActionableModels(slGetSnapshot(), {
    date,
    timeSlot,
    focusMode: slGetFocusMode()
  });
}

function slGetTopTodayModelForDate(date = slState.gameDate, timeSlot = 'day') {
  return slGetActionableModels(date, timeSlot)[0] || null;
}

function slGetBlockedImportantModel(timeSlot) {
  return slGetAdvisor().getBlockedImportantModel(slGetSnapshot(), {
    date: slState.gameDate,
    timeSlot,
    focusMode: slGetFocusMode()
  });
}

function slRenderPlanningInsights() {
  const container = slRoot.querySelector('#sl-planning-insights');
  if (!container) {
    return;
  }

  if (slIsCompletionFocus()) {
    const incomplete = slGetModelsForCurrentState().filter((model) => !model.link.automatic && model.rank < 10);
    const slotBudget = slEstimateRemainingTimeSlots();
    const blockedCritical = incomplete
      .filter((model) => model.completion.state === 'blocked')
      .sort(slCompareModels)
      .slice(0, 3);
    const critical = incomplete.filter((model) => model.completion.criticalPath);
    const remainingRanks = incomplete.reduce((sum, model) => sum + model.completion.requiredSlots, 0);
    const criticalRanks = critical.reduce((sum, model) => sum + model.completion.requiredSlots, 0);

    const budgetHtml = `<section class="sl-planning-panel"><h3>Remaining Manual Time</h3><div class="sl-time-budget-grid"><div class="sl-time-budget-item"><span class="sl-time-budget-label">Day slots still open</span><span class="sl-time-budget-value">${slotBudget.day}</span></div><div class="sl-time-budget-item"><span class="sl-time-budget-label">Evening slots still open</span><span class="sl-time-budget-value">${slotBudget.evening}</span></div><div class="sl-time-budget-item"><span class="sl-time-budget-label">Ranks still to earn</span><span class="sl-time-budget-value">${remainingRanks}</span></div><div class="sl-time-budget-item"><span class="sl-time-budget-label">Critical-path ranks</span><span class="sl-time-budget-value">${criticalRanks}</span></div></div><div class="sl-focus-note sl-time-budget-note">These counts are planning estimates for the ${SL_COMPLETION_REWARD} route. They assume rank-up visits only and do not simulate hidden affinity padding or extra hangouts.</div></section>`;

    const blockersHtml = `<section class="sl-planning-panel"><h3>Completion Blockers</h3>${
      blockedCritical.length
        ? blockedCritical
            .map((item) => {
              const reasons = [];
              if (item.missingStats.length) {
                reasons.push(`${item.missingStats[0].stat} gate`);
              }
              if (item.setupNeeded) {
                reasons.push('needs setup');
              }
              if (item.availability?.status === 'locked_prerequisite') {
                reasons.push('prerequisite gate');
              }
              if (item.completion.daysUntilUnlock > 0) {
                reasons.push(`opens in ${item.completion.daysUntilUnlock}d`);
              }
              reasons.push(`Min windows ${item.completion.remainingWindows}/${item.completion.requiredSlots}`);
              return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.link.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">${item.nextStep}</div><div class="sl-focus-note">${reasons.join(' | ')}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
            })
            .join('')
        : '<div class="sl-rec-empty">No critical Social Link is currently blocked by stats, setup, or unlock timing.</div>'
    }</section>`;

    container.innerHTML = `<div class="sl-planning-grid">${budgetHtml}${blockersHtml}</div>`;
    return;
  }

  const pressureModels = slGetModelsForCurrentState()
    .filter((model) => !model.link.automatic && model.rank < 10 && model.weeklyPressure > 0)
    .sort((left, right) => right.weeklyPressure - left.weeklyPressure || right.todayPriority - left.todayPriority)
    .slice(0, 4);
  const bottlenecks = slGetStatBottlenecks();

  let html = '<div class="sl-planning-grid">';

  html += '<section class="sl-planning-panel"><h3>Watch Later This Week</h3>';
  if (!pressureModels.length) {
    html += '<div class="sl-rec-empty">No weekly pressure is standing out from your current state.</div>';
  } else {
    html += pressureModels
      .map((item) => {
        const reasons = [];
        if (item.deadlineInfo.isSoon && item.deadlineInfo.label) {
          reasons.push(item.deadlineInfo.label);
        }
        if (item.isRare) {
          reasons.push('rare slot');
        }
        if (item.setupNeeded) {
          reasons.push('needs setup');
        }
        if (item.missingStats.length) {
          reasons.push(`${item.missingStats[0].stat} gate`);
        }
        return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.link.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">${item.actionableToday ? 'Actionable today, but mainly important for weekly planning.' : item.nextStep}</div><div class="sl-focus-note">${reasons.join(' | ') || 'Low-frequency opportunity.'}</div></div>`;
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
  const dayPick = dayBlocked ? null : slGetTopTodayModelForDate(currentDate, 'day');
  const eveningPick = eveningBlocked ? null : slGetTopTodayModelForDate(currentDate, 'evening');
  const bottlenecks = slGetStatBottlenecks();

  const renderAction = (label, item, blockedReason, statFallback) => {
    if (blockedReason) {
      return `<div class="sl-action-card blocked"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">Blocked</span></div><div class="sl-action-main">${blockedReason}</div></div>`;
    }
    if (item) {
      const stateLabel = item.actionableToday && !item.availableToday ? 'Start' : slIsCompletionFocus() ? 'Protect now' : 'Best today';
      const why = slGetRecommendationWhy(item) || item.factors.slice(0, 2).join(' | ');
      return `<div class="sl-action-card"><div class="sl-action-top"><span class="sl-action-slot">${label}</span><span class="sl-action-state">${stateLabel}</span></div><div class="sl-action-main">${item.link.character}</div><div class="sl-action-copy">${why}</div>${
        item.deadlineInfo.isSoon && item.deadlineInfo.label ? `<div class="sl-action-note">${item.deadlineInfo.label}</div>` : ''
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
    .filter(
      (model) =>
        !model.link.automatic &&
        model.rank < 10 &&
        (slIsCompletionFocus() ? model.completion.pressure > 0 : model.weeklyPressure > 0)
    )
    .sort(slCompareModels);

  if (!items.length) {
    container.innerHTML = '<div class="sl-rec-empty">No route looks especially fragile from your current date and ranks.</div>';
    return;
  }

  const actionable = items
    .filter((item) => (slIsCompletionFocus() ? item.actionableToday && item.completion.criticalPath : item.actionableToday))
    .slice(0, 3);
  const blocked = items
    .filter((item) => (slIsCompletionFocus() ? !item.actionableToday && item.completion.criticalPath : !item.actionableToday))
    .slice(0, 3);

  const renderGroup = (title, entries) => {
    if (!entries.length) {
      return `<div class="sl-risk-group"><h3>${title}</h3><div class="sl-rec-empty">Nothing in this bucket right now.</div></div>`;
    }
    return `<div class="sl-risk-group"><h3>${title}</h3>${entries
      .map((item) => {
        const reasons = [];
        if (slIsCompletionFocus() && item.completion.criticalPath) {
          reasons.push(`Min windows ${item.completion.remainingWindows}/${item.completion.requiredSlots}`);
        }
        if (item.deadlineInfo.isSoon && item.deadlineInfo.label) {
          reasons.push(item.deadlineInfo.label);
        }
        if (item.isRare) {
          reasons.push(item.actionableToday ? 'rare but available now' : slIsCompletionFocus() ? 'scarce completion slot' : 'rare later this week');
        }
        if (item.setupNeeded) {
          reasons.push('needs setup');
        }
        if (item.missingStats.length) {
          reasons.push(`${item.missingStats[0].stat} gate`);
        }
        return `<div class="sl-risk-item"><div class="sl-risk-top"><span class="sl-risk-name">${item.link.character}</span><span class="sl-risk-arcana">${item.arcana}</span></div><div class="sl-risk-copy">${reasons.join(' | ') || item.nextStep}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
      })
      .join('')}</div>`;
  };

  container.innerHTML = renderGroup(slIsCompletionFocus() ? 'Must act now' : 'Can still act', actionable) + renderGroup(
    slIsCompletionFocus() ? 'Blocked critical' : 'Watch later / blocked',
    blocked
  );
}

function slRenderUnlockNext() {
  const container = slRoot.querySelector('#sl-unlock-next');
  if (!container) {
    return;
  }

  if (slIsCompletionFocus()) {
    const items = slGetModelsForCurrentState()
      .filter((model) => !model.link.automatic && model.rank < 10)
      .filter(
        (model) =>
          model.completion.state === 'blocked' ||
          model.rank === 0 ||
          model.completion.daysUntilUnlock > 0 ||
          model.missingStats.length ||
          model.setupNeeded ||
          model.availability?.status === 'locked_prerequisite'
      )
      .sort(slCompareModels)
      .slice(0, 3);

    if (!items.length) {
      container.innerHTML = '<div class="sl-rec-empty">No completion bottleneck is standing out right now.</div>';
      return;
    }

    container.innerHTML = items
      .map((item) => {
        const labels = [];
        if (item.rank === 0) {
          labels.push(item.actionableToday ? 'Must start now' : 'Not started');
        }
        if (item.missingStats.length) {
          labels.push(`${item.missingStats[0].stat} gate`);
        }
        if (item.setupNeeded) {
          labels.push('needs setup');
        }
        if (item.availability?.status === 'locked_prerequisite') {
          labels.push('prerequisite gate');
        }
        if (item.completion.daysUntilUnlock > 0) {
          labels.push(`opens in ${item.completion.daysUntilUnlock}d`);
        }
        labels.push(`Min windows ${item.completion.remainingWindows}/${item.completion.requiredSlots}`);
        return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.link.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">${
          item.actionableToday ? 'Start or rank this now' : item.nextStep
        }</div><div class="sl-focus-note">${labels.join(' | ')}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
      })
      .join('');
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
    .sort((left, right) => left.unlockDistance - right.unlockDistance || right.weeklyPressure - left.weeklyPressure)
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
  const dayBest = slGetTopTodayModelForDate(slState.gameDate, 'day');
  const eveningBest = slGetTopTodayModelForDate(slState.gameDate, 'evening');
  const premiumItems = [];

  for (let index = 0; index < 7; index += 1) {
    const date = slAdvanceDate(weekStart, index);
    ['day', 'evening'].forEach((timeSlot) => {
      slGetCalLinks(date, null, timeSlot)
        .filter((item) =>
          slIsCompletionFocus()
            ? item.completion.criticalPath || item.deadlineInfo.isSoon
            : item.weeklyPressure > 0 && (item.isRare || item.deadlineInfo.isSoon)
        )
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

  premiumItems.sort(
    (left, right) =>
      slCompareDates(left.date, right.date) ||
      slCompareModels(left, right)
  );

  if (!premiumItems.length) {
    container.innerHTML = `<div class="sl-rec-empty">${
      slIsCompletionFocus()
        ? 'No critical-path Social Link is dominating the rest of this week.'
        : 'No especially scarce social link slots show up this week.'
    }</div>`;
    return;
  }

  container.innerHTML = premiumItems
    .slice(0, 5)
    .map((item) => {
      const tags = [];
      const isCurrentBest =
        item.date.month === slState.gameDate.month &&
        item.date.day === slState.gameDate.day &&
        ((item.timeSlot === 'day' && dayBest?.arcana === item.arcana) ||
          (item.timeSlot === 'evening' && eveningBest?.arcana === item.arcana));

      if (isCurrentBest) {
        tags.push(
          slIsCompletionFocus()
            ? item.timeSlot === 'day'
              ? 'Protect today'
              : 'Protect tonight'
            : item.timeSlot === 'day'
              ? 'Best today'
              : 'Best tonight'
        );
      } else {
        tags.push(slIsCompletionFocus() ? 'Critical later this week' : 'Watch later this week');
      }
      if (slIsCompletionFocus() && item.completion.criticalPath) {
        tags.push(`Min windows ${item.completion.remainingWindows}/${item.completion.requiredSlots}`);
      }
      if (item.isRare) {
        tags.push('Rare slot');
      }
      if (item.deadlineInfo.isSoon && item.deadlineInfo.label) {
        tags.push(item.deadlineInfo.label);
      }
      return `<div class="sl-focus-item"><div class="sl-focus-top"><span class="sl-focus-name">${item.link.character}</span><span class="sl-focus-arcana">${item.arcana}</span></div><div class="sl-focus-meta">${slFormatDate(item.date)} | ${slGetSlotLabel(item.timeSlot)}</div><div class="sl-focus-note">${tags.join(' | ')}</div><div class="sl-risk-actions">${slRenderFocusButton(item.arcana)}</div></div>`;
    })
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

function slRenderFocusModeUi() {
  slRoot.querySelectorAll('.sl-focus-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.focus === slUiState.focusMode);
  });

  const note = slRoot.querySelector('#sl-focus-note');
  if (note) {
    note.textContent = slIsCompletionFocus()
      ? `Completion Focus protects the ${SL_COMPLETION_REWARD} route by prioritizing links that are hardest to finish before ${slFormatDate(SL_COMPLETION_FINAL_DATE)}.`
      : 'Balanced mode now recommends only actionable links and ranks them mainly by remaining windows, scarcity, and deadline pressure.';
  }

  const titleMap = slIsCompletionFocus()
    ? {
        '#sl-progress-title': 'Ultimate Fusion Progress',
        '#sl-recommendations-title': "Today's Completion Moves",
        '#sl-next-actions-title': "Protect Today's Windows",
        '#sl-risk-title': 'Completion Risk',
        '#sl-unlock-title': 'Completion Bottlenecks',
        '#sl-premium-title': 'Critical Path Links',
        '#sl-planning-title': 'Time Budget'
      }
    : {
        '#sl-progress-title': 'Progress Overview',
        '#sl-recommendations-title': "Today's Recommendations",
        '#sl-next-actions-title': 'Best Use of Time',
        '#sl-risk-title': 'At Risk Soon',
        '#sl-unlock-title': 'Unlock Next',
        '#sl-premium-title': 'Premium Slots This Week',
        '#sl-planning-title': 'Planning Focus'
      };

  Object.entries(titleMap).forEach(([selector, text]) => {
    const node = slRoot.querySelector(selector);
    if (node) {
      node.textContent = text;
    }
  });

  const recommendationNote = slRoot.querySelector('#sl-recommendations-note');
  if (recommendationNote) {
    recommendationNote.textContent = slIsCompletionFocus()
      ? `Completion Focus re-ranks this tab around links that are most likely to block the ${SL_COMPLETION_REWARD} path. These are minimum-slot estimates and do not simulate hidden affinity points.`
      : 'Default recommendations now prioritize time trouble first: few remaining windows, limited availability, and hard deadlines. Fusion value only breaks close ties.';
  }
}

function slRenderProgressSummary() {
  const container = slRoot.querySelector('#sl-progress-summary');
  if (!container) {
    return;
  }

  const manualModels = slGetModelsForCurrentState().filter((model) => !model.link.automatic);
  const incomplete = manualModels.filter((model) => model.rank < 10);
  const critical = incomplete.filter((model) => model.completion.criticalPath);
  const blockedCritical = critical.filter((model) => model.completion.state === 'blocked');
  const manualMaxed = manualModels.length - incomplete.length;
  const remainingRanks = incomplete.reduce((sum, model) => sum + model.completion.requiredSlots, 0);
  const minSlack = critical.length
    ? Math.min(...critical.map((model) => model.completion.slack))
    : (incomplete.length ? Math.min(...incomplete.map((model) => model.completion.slack)) : 999);

  let statusLabel = 'On pace';
  let statusTone = 'safe';
  if (blockedCritical.length || minSlack < 0) {
    statusLabel = 'At risk';
    statusTone = 'risk';
  } else if (critical.length || minSlack <= 2) {
    statusLabel = 'Tight';
    statusTone = 'tight';
  }

  if (!slIsCompletionFocus()) {
    container.innerHTML = `<div class="sl-status-summary sl-progress-summary-row"><div class="sl-status-pill"><span class="sl-status-pill-label">Manual links maxed</span><span class="sl-status-pill-value">${manualMaxed}/${manualModels.length}</span></div><div class="sl-status-pill"><span class="sl-status-pill-label">Links still open</span><span class="sl-status-pill-value">${incomplete.length}</span></div><div class="sl-status-pill"><span class="sl-status-pill-label">Critical routes</span><span class="sl-status-pill-value">${critical.length}</span></div></div>`;
    return;
  }

  container.innerHTML = `<div class="sl-completion-summary ${statusTone}"><div class="sl-status-summary sl-progress-summary-row"><div class="sl-status-pill"><span class="sl-status-pill-label">Reward path</span><span class="sl-status-pill-value">${SL_COMPLETION_REWARD}</span></div><div class="sl-status-pill"><span class="sl-status-pill-label">Manual links maxed</span><span class="sl-status-pill-value">${manualMaxed}/${manualModels.length}</span></div><div class="sl-status-pill"><span class="sl-status-pill-label">Completion state</span><span class="sl-status-pill-value">${statusLabel}</span></div><div class="sl-status-pill"><span class="sl-status-pill-label">Rank events left</span><span class="sl-status-pill-value">${remainingRanks}</span></div></div><div class="sl-completion-copy">Finish every Social Link before ${slFormatDate(
    SL_COMPLETION_FINAL_DATE
  )} to stay on the ${SL_COMPLETION_REWARD} route. This estimate uses minimum remaining slots and intentionally does not guess hidden affinity hangouts.</div></div>`;
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

  const recommendations = slGetActionableModels(slState.gameDate, timeSlot);
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
  const primaryKicker = slIsCompletionFocus() ? 'Best completion move' : 'Best today';
  const primarySecondary = slIsCompletionFocus()
    ? `Completion pressure ${Math.max(0, Math.round(primary.completion.pressure))}`
    : `Today priority ${Math.max(0, Math.round(primary.todayPriority))}`;
  const backupTitle = slIsCompletionFocus() ? 'Good backup for completion' : 'Good backup today';
  const blockedTitle = slIsCompletionFocus() ? 'Blocked critical path' : 'Watch later this week';

  let html = `<section class="sl-rec-primary"><div class="sl-rec-header"><span class="sl-rec-kicker">${primaryKicker}</span><span class="sl-rec-secondary">${primarySecondary}</span></div><div class="sl-rec-primary-name-row"><span class="sl-rec-name">${primary.link.character}</span><span class="sl-rec-arcana">${primary.arcana}</span></div>${renderTags(
    primary.tags.slice(0, 4)
  )}<div class="sl-rec-why">${slGetRecommendationWhy(primary) || primary.factors.slice(0, 2).join(' | ')}</div>${
    primary.rosterMatch
      ? `<div class="sl-rec-planning">Matching persona: ${primary.rosterMatch}</div>`
      : '<div class="sl-rec-planning">No matching persona in roster.</div>'
  }${slBuildGuidePreview(primaryNextRank)}<div class="sl-rec-actions">${slRenderFocusButton(primary.arcana)}</div></section>`;

  if (backups.length) {
    html += `<section class="sl-rec-group"><h3>${backupTitle}</h3>${backups
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
    const blockedReason = slIsCompletionFocus()
      ? `${blockedImportant.nextStep} | Min windows ${blockedImportant.completion.remainingWindows}/${blockedImportant.completion.requiredSlots}`
      : blockedImportant.nextStep;
    html += `<section class="sl-rec-group"><h3>${blockedTitle}</h3><div class="sl-rec-item blocked-callout"><div class="sl-rec-info"><div class="sl-rec-name-row"><span class="sl-rec-name">${blockedImportant.link.character}</span><span class="sl-rec-arcana">${blockedImportant.arcana}</span></div>${renderTags(
      blockedImportant.tags.slice(0, 3)
    )}<div class="sl-rec-detail">${blockedReason}</div></div><div class="sl-rec-side">${slRenderFocusButton(
      blockedImportant.arcana,
      'Open link'
    )}</div></div></section>`;
  }

  container.innerHTML = html;
}

function slRenderDashboard() {
  slRenderFocusModeUi();
  slRenderStatusBar();
  slRenderProgressSummary();
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
      const { link, rank } = model;

      if (statusFilter === 'active' && (rank === 0 || rank >= 10 || link.automatic)) {
        return false;
      }
      if (statusFilter === 'maxed' && rank < 10) {
        return false;
      }
      if (statusFilter === 'locked' && (rank > 0 || link.automatic)) {
        return false;
      }
      if (statusFilter === 'unavailable' && model.actionableToday) {
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
        return Number(right.actionableToday) - Number(left.actionableToday) || slCompareModels(left, right);
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
      return slCompareModels(left, right);
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

    let extraHtml = '';
    if (model.extra) {
      const badgeBits = [];
      if (model.extra.priority) {
        badgeBits.push(`<span class="sl-extra-chip">${model.extra.priority}</span>`);
      }
      if (model.extra.deadline) {
        badgeBits.push(`<span class="sl-extra-chip deadline">Deadline: ${model.extra.deadline}</span>`);
      }
      if (model.extra.routeNote) {
        badgeBits.push(`<span class="sl-extra-chip route">${model.extra.routeNote}</span>`);
      }
      const listBits = (model.extra.notes || [])
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
      return slIsCompletionFocus()
        ? item.completion.pressure > 0 && (item.completion.criticalPath || item.deadlineInfo.isSoon || item.isRare)
        : item.weeklyPressure > 0 && (item.deadlineInfo.isSoon || item.isRare || !item.actionableToday);
    }
    if (mode === 'actionable') {
      return item.actionable || item.available;
    }
    return true;
  });

  return filtered.sort(slCompareModels);
}

function slCalLinkHtml(item, timeSlot, options = {}) {
  let cssClass = 'sl-cal-link';
  if (!item.statsMet || item.maxed) {
    cssClass += ' locked';
  }
  if (item.isRare || item.deadlineInfo.isSoon) {
    cssClass += ' premium';
  }
  if (options.recommended) {
    cssClass += ' recommended';
  }

  const rankLabel = item.actionable && !item.available ? 'Start' : item.maxed ? 'MAX' : item.rank;
  let flagText = '';
  if (options.recommended) {
    flagText = options.recommendedLabel || (slIsCompletionFocus() ? 'Protect today' : 'Best today');
  } else if (slIsCompletionFocus() && item.completion.criticalPath) {
    flagText = 'Critical';
  } else if (item.deadlineInfo.isSoon) {
    flagText = item.deadlineInfo.label;
  } else if (item.isRare) {
    flagText = 'Rare';
  }

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

  const currentDayBest = slGetTopTodayModelForDate(slState.gameDate, 'day');
  const currentEveningBest = slGetTopTodayModelForDate(slState.gameDate, 'evening');
  let html = '';

  for (let index = 0; index < 7; index += 1) {
    const date = slAdvanceDate(slCalWeekStart, index);
    const dayOfWeek = slGetDayOfWeek(date.month, date.day);
    const isToday = date.month === slState.gameDate.month && date.day === slState.gameDate.day;
    const blockedDay = slGetBlockedReason(date.month, date.day, 'day');
    const blockedEvening = slGetBlockedReason(date.month, date.day, 'evening');
    const dayLinks = blockedDay ? [] : slGetCalLinks(date, dayOfWeek, 'day');
    const eveningLinks = blockedEvening ? [] : slGetCalLinks(date, dayOfWeek, 'evening');
    const premiumDay = [...dayLinks, ...eveningLinks].some((item) =>
      slIsCompletionFocus()
        ? item.completion.criticalPath || item.deadlineInfo.isSoon
        : item.weeklyPressure > 0 && (item.isRare || item.deadlineInfo.isSoon)
    );

    let cssClass = 'sl-cal-day';
    if (isToday) {
      cssClass += ' today';
    }
    if (blockedDay && blockedEvening) {
      cssClass += ' blocked';
    }

    const todaySummary = [];
    if (isToday && currentDayBest) {
      todaySummary.push(`${slIsCompletionFocus() ? 'Protect day' : 'Best day'}: ${currentDayBest.link.character}`);
    }
    if (isToday && currentEveningBest) {
      todaySummary.push(`${slIsCompletionFocus() ? 'Protect eve' : 'Best eve'}: ${currentEveningBest.link.character}`);
    }

    html += `<div class="${cssClass}"><div class="sl-cal-day-header"><span class="sl-cal-day-name">${DAY_NAMES[dayOfWeek]}</span><span class="sl-cal-day-date">${slFormatDate(
      date
    )}</span></div><div class="sl-cal-day-summary"><span>${dayLinks.length} day</span><span>${eveningLinks.length} eve</span>${
      premiumDay
        ? `<span class="sl-cal-day-premium">${slIsCompletionFocus() ? 'Critical later this week' : 'Watch later this week'}</span>`
        : ''
    }${todaySummary.map((entry) => `<span class="sl-cal-day-best">${entry}</span>`).join('')}</div>`;

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
        const recommended = isToday && currentDayBest && currentDayBest.arcana === item.arcana;
        html += slCalLinkHtml(item, 'day', {
          recommended,
          recommendedLabel: slIsCompletionFocus() ? 'Protect today' : 'Best today'
        });
      });
      if (!dayLinks.length) {
        html += '<div class="sl-cal-empty">No daytime picks</div>';
      }
      html += '</div>';
    }
    if (!blockedEvening) {
      html += '<div class="sl-cal-slot"><div class="sl-cal-slot-label">Evening</div>';
      eveningLinks.forEach((item) => {
        const recommended = isToday && currentEveningBest && currentEveningBest.arcana === item.arcana;
        html += slCalLinkHtml(item, 'evening', {
          recommended,
          recommendedLabel: slIsCompletionFocus() ? 'Protect tonight' : 'Best tonight'
        });
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

function scheduleRerenderAll() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  const run = () => {
    renderQueued = false;
    rerenderAll();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function initSocialLinks({ root, store }) {
  if (initialized) {
    return;
  }

  slRoot = root;
  slStore = store;
  if (window.p3rApp?.getSocialLinkFocusMode) {
    slUiState.focusMode = window.p3rApp.getSocialLinkFocusMode();
  }
  syncState();
  initialized = true;

  if (window.p3rApp?.subscribeToSocialLinkFocusMode) {
    window.p3rApp.subscribeToSocialLinkFocusMode((mode) => {
      if (slUiState.focusMode === mode) {
        return;
      }
      slUiState.focusMode = mode;
      if (initialized) {
        scheduleRerenderAll();
      }
    });
  }

  if (typeof window.mountRunStatePanel === 'function') {
    window.mountRunStatePanel({
      root: slRoot,
      store: slStore,
      selector: '#sl-run-state-card',
      title: 'Social Link Inputs',
      subtitle: 'Date and social stats immediately update unlock checks, calendar availability, and today-first recommendations.',
      fields: ['date', 'academics', 'charm', 'courage'],
      note: 'Carry a matching arcana persona for bonus points, but the route logic itself reads from these shared values.'
    });
  }

  slRoot.querySelectorAll('.sl-tab-btn').forEach((button) => {
    button.addEventListener('click', () => slSwitchTab(button.dataset.tab));
  });

  slRoot.querySelectorAll('.sl-time-btn').forEach((button) => {
    button.addEventListener('click', () => {
      slRoot.querySelectorAll('.sl-time-btn').forEach((entry) => {
        entry.classList.toggle('active', entry === button);
      });
      slRenderRecommendations();
      slRenderBestUseBoard();
      slRenderCalendar();
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
    const modeButton = event.target.closest('.sl-focus-btn');
    if (modeButton) {
      const nextMode = modeButton.dataset.focus === 'completion' ? 'completion' : 'balanced';
      if (window.p3rApp?.setSocialLinkFocusMode) {
        window.p3rApp.setSocialLinkFocusMode(nextMode);
      } else if (slUiState.focusMode !== nextMode) {
        slUiState.focusMode = nextMode;
        slRenderDashboard();
        slRenderMyLinks();
        slRenderCalendar();
      }
      return;
    }

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

  slStore.subscribe(scheduleRerenderAll);
  slRenderDashboard();
}

window.initSocialLinks = initSocialLinks;
})();
