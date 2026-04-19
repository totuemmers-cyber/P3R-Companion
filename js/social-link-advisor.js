(() => {
const SL_COMPLETION_FINAL_DATE = { month: 1, day: 30 };
const SL_COMPLETION_REWARD = 'Orpheus Telos';
let fusionCache = null;

function normalizeFocusMode(focusMode) {
  return focusMode === 'completion' ? 'completion' : 'balanced';
}

function getLink(arcana) {
  if (typeof window.getSocialLinkDefinition === 'function') {
    return window.getSocialLinkDefinition(arcana);
  }
  return SOCIAL_LINKS[arcana];
}

function getLinkExtra(arcana) {
  if (typeof SOCIAL_LINK_EXTRAS === 'undefined') {
    return null;
  }
  return SOCIAL_LINK_EXTRAS[arcana] || null;
}

function getRosterSet(snapshot) {
  return new Set(snapshot.roster || []);
}

function getRosterMatchForArcana(arcana, snapshot) {
  const roster = getRosterSet(snapshot);
  for (const name of roster) {
    if (PERSONAS[name] && PERSONAS[name].race === arcana) {
      return name;
    }
  }
  return null;
}

function dateToNum(date) {
  const month = date.month >= 4 ? date.month : date.month + 12;
  return month * 100 + date.day;
}

function compareDates(left, right) {
  return dateToNum(left) - dateToNum(right);
}

function daysBetween(left, right) {
  const leftYear = left.month >= 4 ? 2009 : 2010;
  const rightYear = right.month >= 4 ? 2009 : 2010;
  const leftDate = new Date(leftYear, left.month - 1, left.day);
  const rightDate = new Date(rightYear, right.month - 1, right.day);
  return Math.round((rightDate - leftDate) / 86400000);
}

function advanceDate(date, days) {
  const year = date.month >= 4 ? 2009 : 2010;
  const current = new Date(year, date.month - 1, date.day);
  current.setDate(current.getDate() + days);
  return {
    month: current.getMonth() + 1,
    day: current.getDate()
  };
}

function formatDate(date) {
  return `${MONTH_NAMES[date.month]} ${date.day}`;
}

function statsMet(arcana, snapshot) {
  const link = getLink(arcana);
  if (!link) {
    return false;
  }
  return Object.entries(link.statRequirements).every(
    ([stat, requirement]) => (snapshot.profile.stats[stat] || 1) >= requirement
  );
}

function getBlockedReason(date, timeSlot) {
  if (typeof window.getSocialLinkBlockedReason === 'function') {
    return window.getSocialLinkBlockedReason(date, timeSlot);
  }
  const dayNumber = dateToNum(date);
  for (const blocked of BLOCKED_DATES) {
    if (dayNumber >= dateToNum(blocked.from) && dayNumber <= dateToNum(blocked.to)) {
      if (blocked.block === 'both' || blocked.block === timeSlot) {
        return blocked.reason;
      }
    }
  }
  return null;
}

function getAvailabilityState(arcana, snapshot, date, timeSlot = null) {
  return typeof window.getSocialLinkAvailability === 'function'
    ? window.getSocialLinkAvailability(arcana, snapshot, date, timeSlot)
    : null;
}

function countFusionPairs(arcana) {
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

function countPersonas(arcana) {
  let count = 0;
  Object.values(PERSONAS).forEach((persona) => {
    if (persona.race === arcana) {
      count += 1;
    }
  });
  return count;
}

function getFusionData(arcana) {
  if (!fusionCache) {
    fusionCache = {};
    ARCANA_LIST.forEach((entry) => {
      fusionCache[entry] = {
        pairs: countFusionPairs(entry),
        personas: countPersonas(entry)
      };
    });
  }
  return fusionCache[arcana] || { pairs: 0, personas: 0 };
}

function scoreLink(arcana, snapshot, date = snapshot.profile.gameDate) {
  const link = getLink(arcana);
  const currentRank = snapshot.socialLinks.ranks[arcana] || 0;
  if (!link || currentRank >= 10) {
    return { score: -1, factors: [] };
  }

  let score = 0;
  const factors = [];
  const fusion = getFusionData(arcana);

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
    const daysLeft = daysBetween(date, link.endDate);
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

  if (!statsMet(arcana, snapshot)) {
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

  const rosterMatch = getRosterMatchForArcana(arcana, snapshot);
  const roster = getRosterSet(snapshot);
  if (rosterMatch) {
    score += 2;
    factors.push(`Have ${rosterMatch} for arcana bonus`);
  } else if (roster.size > 0) {
    score -= 1;
    factors.push(`No ${arcana} persona in roster`);
  }

  return { score, factors };
}

function getSlotLabel(timeSlot) {
  return timeSlot === 'evening' ? 'Evening' : 'Daytime';
}

function formatAvailableDays(days) {
  if (!Array.isArray(days) || !days.length) {
    return 'story';
  }
  return days.map((day) => DAY_NAMES[day]).join('/');
}

function getMissingStats(link, snapshot) {
  return Object.entries(link?.statRequirements || {})
    .filter(([stat, requirement]) => (snapshot.profile.stats[stat] || 1) < requirement)
    .map(([stat, requirement]) => ({
      stat,
      current: snapshot.profile.stats[stat] || 1,
      requirement,
      label: `${SOCIAL_STATS[stat][requirement - 1]} ${stat}`
    }));
}

function getDeadlineInfo(link, extra, date) {
  if (link?.endDate) {
    const daysLeft = daysBetween(date, link.endDate);
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

function isRareLink(link) {
  return !!link && (!!link.availableDays?.includes(0) || (link.availableDays || []).length <= 2);
}

function getChecklistItems(link, rank, availability, snapshot, date) {
  const items = [];

  if (link?.unlockDate) {
    items.push({
      label: `Unlock date reached (${formatDate(link.unlockDate)})`,
      met: compareDates(date, link.unlockDate) >= 0
    });
  }

  Object.entries(link?.statRequirements || {}).forEach(([stat, requirement]) => {
    const current = snapshot.profile.stats[stat] || 1;
    items.push({
      label: `${SOCIAL_STATS[stat][requirement - 1]} ${stat} (${current}/${requirement})`,
      met: current >= requirement
    });
  });

  (link?.prerequisites || []).forEach((prerequisite) => {
    let met = false;
    if (prerequisite.type === 'started') {
      met = (snapshot.socialLinks.ranks[prerequisite.arcana] || 0) > 0;
    } else if (prerequisite.type === 'rank') {
      met = (snapshot.socialLinks.ranks[prerequisite.arcana] || 0) >= prerequisite.minRank;
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

function getGuideSummaryBits(link) {
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

function getNextStep(model) {
  const { link, availability, missingStats } = model;

  if (!link || link.automatic) {
    return 'Story progression only.';
  }
  if (availability?.available) {
    return `Talk to ${link.character} ${getSlotLabel(link.timeSlot).toLowerCase()} at ${link.location}.`;
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
    return `Check ${formatAvailableDays(link.availableDays)} ${getSlotLabel(link.timeSlot).toLowerCase()}.`;
  }
  if (availability?.reason) {
    return availability.reason;
  }
  return `Check ${formatAvailableDays(link.availableDays)} ${getSlotLabel(link.timeSlot).toLowerCase()}.`;
}

function getPlanningEndDate(link) {
  if (!link?.endDate) {
    return SL_COMPLETION_FINAL_DATE;
  }
  return compareDates(link.endDate, SL_COMPLETION_FINAL_DATE) <= 0 ? link.endDate : SL_COMPLETION_FINAL_DATE;
}

function estimateRemainingOpportunities(arcana, link, snapshot, startDate, completionCache) {
  const rank = snapshot.socialLinks.ranks[arcana] || 0;
  if (!link || link.automatic || rank >= 10) {
    return 0;
  }

  const endDate = getPlanningEndDate(link);
  const firstDate =
    link.unlockDate && compareDates(startDate, link.unlockDate) < 0 ? link.unlockDate : startDate;
  if (compareDates(firstDate, endDate) > 0) {
    return 0;
  }

  const cacheKey = `${arcana}|${firstDate.month}/${firstDate.day}`;
  if (completionCache.has(cacheKey)) {
    return completionCache.get(cacheKey);
  }

  let count = 0;
  let cursor = firstDate;
  while (compareDates(cursor, endDate) <= 0) {
    const availability = getAvailabilityState(arcana, snapshot, cursor, link.timeSlot || null);
    if (availability && (availability.available || availability.actionable)) {
      count += 1;
    }
    cursor = advanceDate(cursor, 1);
  }

  completionCache.set(cacheKey, count);
  return count;
}

function getCompletionMetrics({
  arcana,
  link,
  rank,
  availability,
  missingStats,
  isRare,
  setupNeeded,
  deadlineInfo,
  snapshot,
  date,
  completionCache
}) {
  const planningEndDate = getPlanningEndDate(link);
  const requiredSlots = link?.automatic ? 0 : Math.max(0, 10 - rank);
  const remainingWindows = estimateRemainingOpportunities(arcana, link, snapshot, date, completionCache);
  const daysUntilUnlock =
    link?.unlockDate && compareDates(date, link.unlockDate) < 0 ? daysBetween(date, link.unlockDate) : 0;
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

function getTodayPriority({
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

function getWeeklyPressure({ deadlineInfo, isRare, rank, missingStats, setupNeeded, actionableToday, completion, link }) {
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

function getMyLinksTags(model, focusMode) {
  if (normalizeFocusMode(focusMode) === 'completion') {
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

function buildLinkModel(arcana, snapshot, date, focusMode, completionCache) {
  const link = getLink(arcana);
  const rank = snapshot.socialLinks.ranks[arcana] || 0;
  const extra = getLinkExtra(arcana);
  const availability = getAvailabilityState(arcana, snapshot, date, link?.timeSlot || null);
  const scoreResult = scoreLink(arcana, snapshot, date);
  const rosterMatch = getRosterMatchForArcana(arcana, snapshot);
  const missingStats = getMissingStats(link, snapshot);
  const deadlineInfo = getDeadlineInfo(link, extra, date);
  const checklist = getChecklistItems(link, rank, availability, snapshot, date);
  const guideSummaryBits = getGuideSummaryBits(link);
  const actionableToday = !!(availability?.available || availability?.actionable);
  const availableToday = !!availability?.available;
  const isRare = isRareLink(link);
  const noPersona = !rosterMatch && !link?.automatic;
  const setupNeeded = availability?.status === 'setup_needed';
  const schoolLink = !!link?.schoolLink;
  const sundayLink = !!link?.availableDays?.includes(0);
  const score = Number.isFinite(scoreResult.score) ? scoreResult.score : 0;
  const completion = getCompletionMetrics({
    arcana,
    link,
    rank,
    availability,
    missingStats,
    isRare,
    setupNeeded,
    deadlineInfo,
    snapshot,
    date,
    completionCache
  });
  const todayPriority = getTodayPriority({
    availableToday,
    actionableToday,
    deadlineInfo,
    isRare,
    link,
    noPersona,
    setupNeeded,
    completion,
    score
  });
  const weeklyPressure = getWeeklyPressure({
    deadlineInfo,
    isRare,
    rank,
    missingStats,
    setupNeeded,
    actionableToday,
    completion,
    link
  });

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
    todayPriority,
    weeklyPressure,
    completion
  };

  model.nextStep = getNextStep(model);
  model.tags = getMyLinksTags(model, focusMode);
  return model;
}

function compareModels(left, right, options = {}) {
  const focusMode = normalizeFocusMode(options.focusMode);
  if (focusMode === 'completion') {
    return (
      right.completion.pressure - left.completion.pressure ||
      left.completion.slack - right.completion.slack ||
      right.todayPriority - left.todayPriority ||
      left.link.character.localeCompare(right.link.character)
    );
  }

  return (
    Number(right.actionableToday) - Number(left.actionableToday) ||
    right.todayPriority - left.todayPriority ||
    right.weeklyPressure - left.weeklyPressure ||
    left.completion.slack - right.completion.slack ||
    right.score - left.score ||
    left.link.character.localeCompare(right.link.character)
  );
}

function getRecommendationWhy(model, options = {}) {
  const focusMode = normalizeFocusMode(options.focusMode);
  if (focusMode === 'completion') {
    const reasons = [];
    if (model.completion.criticalPath) {
      reasons.push(`Critical path for ${SL_COMPLETION_REWARD}.`);
    }
    if (model.completion.state === 'must_act_now') {
      reasons.push(`Minimum safe windows are almost gone: ${model.completion.remainingWindows} left for ${model.completion.requiredSlots} rank events.`);
    } else if (model.completion.state === 'tight') {
      reasons.push(`Schedule is tight: ${model.completion.remainingWindows} windows left for ${model.completion.requiredSlots} rank events.`);
    } else if (model.completion.state === 'blocked') {
      reasons.push('This route matters for completion, but it is blocked right now.');
    }
    if (model.setupNeeded) {
      reasons.push('Setup still needs to be cleared.');
    } else if (model.missingStats.length) {
      reasons.push(`${model.missingStats[0].stat} is still below the required rank.`);
    } else if (model.actionableToday) {
      reasons.push(`You can protect this ${getSlotLabel(model.link.timeSlot).toLowerCase()} slot today.`);
    }
    if (model.isRare) {
      reasons.push('It competes for scarce weekly slots.');
    }
    return reasons.slice(0, 3).join(' ');
  }

  const reasons = [];

  if (model.completion.slack <= 0) {
    reasons.push(`Only ${model.completion.remainingWindows} safe window${model.completion.remainingWindows === 1 ? '' : 's'} remain for ${model.completion.requiredSlots} rank events.`);
  } else if (model.completion.slack <= 2) {
    reasons.push(`Tight route: ${model.completion.remainingWindows} windows left for ${model.completion.requiredSlots} rank events.`);
  } else if (model.completion.slack <= 5) {
    reasons.push('Less schedule slack than most links right now.');
  }
  if (model.deadlineInfo.isSoon && model.actionableToday && model.deadlineInfo.label) {
    reasons.push(model.deadlineInfo.label);
  }
  if (model.isRare && model.actionableToday) {
    reasons.push(`Only ${model.link.availableDays.length} day${model.link.availableDays.length === 1 ? '' : 's'} each week.`);
  }
  if (model.actionableToday && !model.availableToday) {
    reasons.push('Ready to start right now.');
  } else if (model.availableToday) {
    reasons.push(`Open ${getSlotLabel(model.link.timeSlot).toLowerCase()} at ${model.link.location}.`);
  }
  if (model.noPersona) {
    reasons.push(`Bring a ${model.arcana} persona next time.`);
  }

  return reasons.slice(0, 3).join(' ');
}

function getModel(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const focusMode = normalizeFocusMode(options.focusMode);
  const completionCache = new Map();
  return buildLinkModel(options.arcana, snapshot, date, focusMode, completionCache);
}

function getModels(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const focusMode = normalizeFocusMode(options.focusMode);
  const completionCache = new Map();
  return ARCANA_LIST.map((arcana) => buildLinkModel(arcana, snapshot, date, focusMode, completionCache));
}

function getActionableModels(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const timeSlot = options.timeSlot || 'day';
  const focusMode = normalizeFocusMode(options.focusMode);
  return getModels(snapshot, { date, focusMode })
    .filter(
      (model) =>
        model.link &&
        !model.link.automatic &&
        model.rank < 10 &&
        model.link.timeSlot === timeSlot &&
        model.actionableToday
    )
    .sort((left, right) => compareModels(left, right, { focusMode }));
}

function getTopModelForDate(snapshot, options = {}) {
  return getActionableModels(snapshot, options)[0] || null;
}

function getBlockedImportantModel(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const timeSlot = options.timeSlot || 'day';
  const focusMode = normalizeFocusMode(options.focusMode);
  return getModels(snapshot, { date, focusMode })
    .filter(
      (model) =>
        model.link &&
        !model.link.automatic &&
        model.rank < 10 &&
        model.link.timeSlot === timeSlot &&
        !model.actionableToday &&
        (focusMode === 'completion' ? model.completion.pressure > 0 : model.weeklyPressure > 0)
    )
    .sort((left, right) => compareModels(left, right, { focusMode }) || left.rank - right.rank)[0] || null;
}

function getStatBottlenecks(snapshot) {
  const bottlenecks = {
    academics: [],
    charm: [],
    courage: []
  };

  ARCANA_LIST.forEach((arcana) => {
    const link = getLink(arcana);
    if (!link || link.automatic || (snapshot.socialLinks.ranks[arcana] || 0) >= 10) {
      return;
    }
    Object.entries(link.statRequirements).forEach(([stat, requirement]) => {
      const current = snapshot.profile.stats[stat] || 1;
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

window.socialLinkAdvisor = {
  completionFinalDate: SL_COMPLETION_FINAL_DATE,
  completionReward: SL_COMPLETION_REWARD,
  compareModels,
  getModel,
  getModels,
  getActionableModels,
  getTopModelForDate,
  getBlockedImportantModel,
  getStatBottlenecks,
  getRecommendationWhy,
  getBlockedReason
};
})();
