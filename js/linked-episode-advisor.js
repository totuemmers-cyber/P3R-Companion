(() => {
const LINKED_EPISODE_FINAL_DATE = { month: 1, day: 30 };
const LINKED_EPISODE_UNLOCKS = ['Surt', 'Horus', 'Byakko', 'Michael', 'Hell Biker', 'Saturnus'];

function getEpisodes() {
  return typeof LINKED_EPISODES !== 'undefined' ? LINKED_EPISODES : [];
}

function getEpisode(id) {
  return getEpisodes().find((episode) => episode.id === id) || null;
}

function getCompleted(snapshot) {
  return snapshot?.linkedEpisodes?.completed || {};
}

function getSkipped(snapshot) {
  return snapshot?.linkedEpisodes?.skipped || {};
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

function getDayOfWeek(date) {
  const year = date.month >= 4 ? 2009 : 2010;
  return new Date(year, date.month - 1, date.day).getDay();
}

function formatDate(date) {
  return `${MONTH_NAMES[date.month]} ${date.day}`;
}

function formatEpisodeNumber(episode) {
  return typeof episode === 'number' ? `Episode ${episode}` : String(episode);
}

function isDateInWindow(episode, date) {
  return compareDates(date, episode.startDate) >= 0 && compareDates(date, episode.deadline) <= 0;
}

function matchesSpecificDate(episode, date) {
  return (episode.availableDates || []).some((entry) => entry.month === date.month && entry.day === date.day);
}

function isScheduledOnDate(episode, date) {
  if (!isDateInWindow(episode, date)) {
    return false;
  }
  if (Array.isArray(episode.availableDates) && episode.availableDates.length) {
    return matchesSpecificDate(episode, date);
  }
  if (Array.isArray(episode.availableDays) && episode.availableDays.length) {
    return episode.availableDays.includes(getDayOfWeek(date));
  }
  return true;
}

function isCompleted(id, snapshot) {
  return Boolean(getCompleted(snapshot)[id]);
}

function isSkipped(id, snapshot) {
  return Boolean(getSkipped(snapshot)[id]);
}

function isExpired(episode, date) {
  return compareDates(date, episode.deadline) > 0;
}

function isRequiredChainBroken(episode, snapshot, date) {
  let previousId = episode.requiredPreviousId;
  while (previousId) {
    const previous = getEpisode(previousId);
    if (!previous) {
      return { blocked: true, reason: 'Missing prerequisite episode data.' };
    }
    if (isCompleted(previousId, snapshot)) {
      previousId = previous.requiredPreviousId;
      continue;
    }
    if (isSkipped(previousId, snapshot)) {
      return { blocked: true, reason: `${previous.character} ${formatEpisodeNumber(previous.episode)} was skipped.` };
    }
    if (isExpired(previous, date)) {
      return { blocked: true, reason: `${previous.character} ${formatEpisodeNumber(previous.episode)} was missed.` };
    }
    return { blocked: false, reason: `Requires ${previous.character} ${formatEpisodeNumber(previous.episode)} first.` };
  }
  return { blocked: false, reason: '' };
}

function getAvailability(episode, snapshot, date = snapshot.profile.gameDate, timeSlot = null) {
  if (isCompleted(episode.id, snapshot)) {
    return { status: 'complete', actionable: false, available: false, reason: 'Already completed.' };
  }
  if (isSkipped(episode.id, snapshot)) {
    return { status: 'skipped', actionable: false, available: false, reason: 'Marked skipped.' };
  }
  const chain = isRequiredChainBroken(episode, snapshot, date);
  if (chain.blocked && /missed|skipped|Missing/.test(chain.reason)) {
    return { status: 'blocked', actionable: false, available: false, reason: chain.reason };
  }
  if (compareDates(date, episode.startDate) < 0) {
    return { status: 'upcoming', actionable: false, available: false, reason: `Opens ${formatDate(episode.startDate)}.` };
  }
  if (isExpired(episode, date)) {
    return { status: 'missed', actionable: false, available: false, reason: `Expired ${formatDate(episode.deadline)}.` };
  }
  if (!isScheduledOnDate(episode, date)) {
    return { status: 'unscheduled', actionable: false, available: false, reason: 'Not scheduled for this date.' };
  }
  if (chain.reason) {
    return { status: 'locked_previous', actionable: false, available: false, reason: chain.reason };
  }
  if (timeSlot && episode.timeSlot !== 'auto' && episode.timeSlot !== timeSlot) {
    return { status: 'wrong_timeslot', actionable: false, available: false, reason: 'Wrong time slot.' };
  }
  if (timeSlot && episode.timeSlot === 'auto' && timeSlot !== 'evening' && timeSlot !== 'day') {
    return { status: 'wrong_timeslot', actionable: false, available: false, reason: 'Automatic reminder.' };
  }
  return {
    status: episode.takesTime ? 'available' : 'reminder',
    actionable: true,
    available: episode.takesTime,
    reason: ''
  };
}

function getDeadlineInfo(episode, date) {
  const daysLeft = daysBetween(date, episode.deadline);
  return {
    daysLeft,
    label: daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Last day' : `${daysLeft}d left`,
    isSoon: daysLeft >= 0 && daysLeft <= 3,
    isExpired: daysLeft < 0
  };
}

function countRemainingRequiredEpisodes(episode, snapshot) {
  const episodes = getEpisodes().filter((entry) => entry.character === episode.character && !entry.optional);
  return episodes.filter((entry) => !isCompleted(entry.id, snapshot) && compareDates(entry.deadline, episode.startDate) >= 0).length;
}

function getPressure(episode, availability, deadlineInfo, snapshot, date) {
  let pressure = 0;
  const daysToOpen = daysBetween(date, episode.startDate);
  if (availability.status === 'missed' || availability.status === 'blocked') {
    pressure += 80;
  }
  if (episode.storyCritical && (availability.actionable || daysToOpen <= 3)) {
    pressure += 95;
  }
  if (episode.personaUnlock && (availability.actionable || (deadlineInfo.daysLeft >= 0 && deadlineInfo.daysLeft <= 10))) {
    pressure += 45;
  }
  if (deadlineInfo.daysLeft >= 0 && deadlineInfo.daysLeft <= 3) {
    pressure += 52 - deadlineInfo.daysLeft * 8;
  } else if (deadlineInfo.daysLeft >= 0 && deadlineInfo.daysLeft <= 10) {
    pressure += 18;
  }
  if (episode.takesTime === false && !episode.storyCritical) {
    pressure -= 22;
  }
  if (episode.deadline.month === 1 && episode.deadline.day === 30 && !episode.personaUnlock) {
    pressure -= 18;
  }
  if (availability.actionable || daysToOpen <= 7 || deadlineInfo.daysLeft <= 10) {
    pressure += Math.max(0, 6 - countRemainingRequiredEpisodes(episode, snapshot));
  }
  return pressure;
}

function getTodayPriority(episode, availability, deadlineInfo, snapshot, date) {
  if (!availability.actionable) {
    return -400;
  }
  let total = episode.takesTime ? 240 : 150;
  total += getPressure(episode, availability, deadlineInfo, snapshot, date) * 2;
  if (episode.storyCritical) {
    total += 220;
  }
  if (deadlineInfo.daysLeft >= 0 && deadlineInfo.daysLeft <= 3) {
    total += 95 - deadlineInfo.daysLeft * 12;
  }
  if (episode.personaUnlock) {
    total += 58;
  }
  if (episode.id === 'junpei-03') {
    total += 260;
  }
  if (episode.id === 'junpei-chidori-flowers') {
    total += 240;
  }
  if (episode.character === 'Koromaru' && !episode.personaUnlock && deadlineInfo.daysLeft > 20) {
    total -= 90;
  }
  if (episode.takesTime === false && !episode.storyCritical) {
    total -= 80;
  }
  return total;
}

function getNextStep(episode, availability) {
  if (availability.status === 'complete') {
    return 'Completed.';
  }
  if (availability.status === 'skipped') {
    return 'Marked skipped.';
  }
  if (availability.reason) {
    return availability.reason;
  }
  if (episode.id === 'junpei-03') {
    return "Start Junpei's Chidori route today.";
  }
  if (episode.id === 'junpei-chidori-flowers') {
    return "Buy White Flowers and give them to Junpei before Nov 20 to unlock Chidori's January events.";
  }
  if (episode.timeSlot === 'auto') {
    return `${formatEpisodeNumber(episode.episode)} occurs automatically at ${episode.location}.`;
  }
  if (episode.takesTime) {
    return `Meet ${episode.character} at ${episode.location}.`;
  }
  return `${episode.notes || `Handle ${episode.character} ${formatEpisodeNumber(episode.episode)}.`}`;
}

function getTags(episode, availability, deadlineInfo) {
  const tags = ['Linked Episode'];
  if (episode.storyCritical) {
    tags.push('Story critical');
  }
  if (deadlineInfo.daysLeft >= 0 && deadlineInfo.daysLeft <= 3) {
    tags.push('Urgent');
  }
  if (episode.personaUnlock) {
    tags.push(`Unlocks ${episode.personaUnlock}`);
  }
  if (!episode.takesTime) {
    tags.push('No time');
  }
  if (availability.status === 'blocked' || availability.status === 'missed') {
    tags.push('Blocked');
  }
  return tags.slice(0, 4);
}

function buildModel(episode, snapshot, date = snapshot.profile.gameDate, timeSlot = null) {
  const availability = getAvailability(episode, snapshot, date, timeSlot);
  const deadlineInfo = getDeadlineInfo(episode, date);
  const pressure = getPressure(episode, availability, deadlineInfo, snapshot, date);
  const todayPriority = getTodayPriority(episode, availability, deadlineInfo, snapshot, date);
  const remainingWindows = estimateRemainingOpportunities(episode, snapshot, date);
  const requiredSlots = episode.optional || !episode.takesTime ? 0 : 1;
  const completionState = isCompleted(episode.id, snapshot)
    ? 'done'
    : availability.status === 'blocked' || availability.status === 'missed'
      ? 'missed'
      : deadlineInfo.daysLeft >= 0 && deadlineInfo.daysLeft <= 3
        ? 'must_act_now'
        : pressure >= 40
          ? 'watch'
          : 'safe';
  const model = {
    type: 'linkedEpisode',
    id: episode.id,
    linkedEpisode: episode,
    arcana: 'Linked Episode',
    link: {
      character: episode.character,
      description: episode.notes || '',
      location: episode.location,
      timeSlot: episode.timeSlot === 'auto' ? 'evening' : episode.timeSlot,
      ranks: [],
      automatic: episode.timeSlot === 'auto',
      availableDays: episode.availableDays || [],
      unlockDate: episode.startDate,
      endDate: episode.deadline,
      statRequirements: {}
    },
    rank: typeof episode.episode === 'number' ? episode.episode - 1 : 0,
    availability,
    actionableToday: availability.actionable,
    availableToday: availability.available,
    setupNeeded: false,
    missingStats: [],
    rosterMatch: null,
    noPersona: false,
    deadlineInfo,
    checklist: getChecklist(episode, snapshot, date),
    guideSummaryBits: [],
    isRare: false,
    isScarce: false,
    availabilityCategory: { category: 'linked', dayCount: episode.availableDays?.length || 0, isScarce: false },
    availableDayCount: episode.availableDays?.length || 0,
    availabilityLabel: 'Story window',
    schoolLink: false,
    sundayLink: episode.availableDays?.includes(0) || false,
    score: Math.max(0, Math.round(pressure / 2)),
    factors: getFactors(episode, deadlineInfo),
    todayPriority,
    weeklyPressure: pressure,
    completion: {
      reward: episode.personaUnlock || '',
      planningEndDate: episode.deadline || LINKED_EPISODE_FINAL_DATE,
      requiredSlots,
      remainingWindows,
      slack: remainingWindows - requiredSlots,
      daysUntilUnlock: Math.max(0, daysBetween(date, episode.startDate)),
      pressure,
      criticalPath: episode.storyCritical || deadlineInfo.isSoon || Boolean(episode.personaUnlock),
      actionableNow: availability.actionable,
      state: completionState
    }
  };
  model.tags = getTags(episode, availability, deadlineInfo);
  model.nextStep = getNextStep(episode, availability);
  return model;
}

function getChecklist(episode, snapshot, date) {
  const items = [
    {
      label: `Window opened (${formatDate(episode.startDate)})`,
      met: compareDates(date, episode.startDate) >= 0
    },
    {
      label: `Before deadline (${formatDate(episode.deadline)})`,
      met: compareDates(date, episode.deadline) <= 0
    }
  ];
  if (episode.requiredPreviousId) {
    const previous = getEpisode(episode.requiredPreviousId);
    items.push({
      label: previous ? `${previous.character} ${formatEpisodeNumber(previous.episode)} complete` : 'Previous episode complete',
      met: isCompleted(episode.requiredPreviousId, snapshot)
    });
  }
  return items;
}

function getFactors(episode, deadlineInfo) {
  const factors = [];
  if (episode.storyCritical) {
    factors.push('Story-sensitive route warning');
  }
  if (episode.personaUnlock) {
    factors.push(`Final reward unlocks ${episode.personaUnlock}`);
  }
  if (deadlineInfo.daysLeft >= 0) {
    factors.push(deadlineInfo.daysLeft === 0 ? 'Last day' : `${deadlineInfo.daysLeft} days left`);
  }
  if (!episode.takesTime) {
    factors.push('No time slot consumed');
  }
  return factors;
}

function estimateRemainingOpportunities(episode, snapshot, startDate) {
  if (isCompleted(episode.id, snapshot) || isSkipped(episode.id, snapshot)) {
    return 0;
  }
  if (compareDates(startDate, episode.deadline) > 0) {
    return 0;
  }
  let count = 0;
  let cursor = compareDates(startDate, episode.startDate) < 0 ? episode.startDate : startDate;
  while (compareDates(cursor, episode.deadline) <= 0) {
    const availability = getAvailability(episode, snapshot, cursor, episode.timeSlot === 'auto' ? null : episode.timeSlot);
    if (availability.actionable) {
      count += 1;
    }
    cursor = advanceDate(cursor, 1);
  }
  return count;
}

function compareModels(left, right) {
  return (
    Number(right.actionableToday) - Number(left.actionableToday) ||
    Number(right.linkedEpisode.storyCritical) - Number(left.linkedEpisode.storyCritical) ||
    right.todayPriority - left.todayPriority ||
    right.weeklyPressure - left.weeklyPressure ||
    left.deadlineInfo.daysLeft - right.deadlineInfo.daysLeft ||
    left.linkedEpisode.character.localeCompare(right.linkedEpisode.character) ||
    String(left.linkedEpisode.episode).localeCompare(String(right.linkedEpisode.episode))
  );
}

function getModels(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const timeSlot = options.timeSlot || null;
  return getEpisodes().map((episode) => buildModel(episode, snapshot, date, timeSlot));
}

function getActionableModels(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const timeSlot = options.timeSlot || 'day';
  return getModels(snapshot, { date, timeSlot })
    .filter((model) => {
      if (!model.actionableToday) {
        return false;
      }
      if (model.linkedEpisode.timeSlot === 'auto') {
        return false;
      }
      if (model.linkedEpisode.timeSlot !== timeSlot) {
        return false;
      }
      if (!model.linkedEpisode.takesTime && !model.linkedEpisode.storyCritical) {
        return false;
      }
      return true;
    })
    .sort(compareModels);
}

function getTopModelForDate(snapshot, options = {}) {
  return getActionableModels(snapshot, options)[0] || null;
}

function getBlockedImportantModel(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const timeSlot = options.timeSlot || 'day';
  return getModels(snapshot, { date, timeSlot })
    .filter((model) => {
      const episode = model.linkedEpisode;
      if (isCompleted(episode.id, snapshot) || isSkipped(episode.id, snapshot)) {
        return false;
      }
      if (episode.timeSlot !== timeSlot) {
        return false;
      }
      return model.weeklyPressure > 0 && (model.deadlineInfo.isSoon || episode.storyCritical || episode.personaUnlock);
    })
    .sort(compareModels)[0] || null;
}

function getRecommendationWhy(model) {
  const episode = model.linkedEpisode;
  if (episode.id === 'junpei-03') {
    return "Start Junpei's Chidori route today.";
  }
  if (episode.id === 'junpei-chidori-flowers') {
    return "Buy White Flowers and give them to Junpei before Nov 20 to unlock Chidori's January events.";
  }
  const reasons = [];
  if (episode.storyCritical) {
    reasons.push('Story-sensitive consequence.');
  }
  if (model.deadlineInfo.daysLeft >= 0 && model.deadlineInfo.daysLeft <= 3) {
    reasons.push(model.deadlineInfo.daysLeft === 0 ? 'Last day.' : `${model.deadlineInfo.daysLeft} days left.`);
  }
  if (episode.personaUnlock) {
    reasons.push(`Final episode unlocks ${episode.personaUnlock}.`);
  }
  if (episode.takesTime) {
    reasons.push(`Available at ${episode.location}.`);
  } else {
    reasons.push('Does not consume a time slot.');
  }
  return reasons.slice(0, 3).join(' ');
}

function getCharacterGroups(snapshot, options = {}) {
  const date = options.date || snapshot.profile.gameDate;
  const groups = new Map();
  getModels(snapshot, { date }).forEach((model) => {
    const character = model.linkedEpisode.character;
    if (!groups.has(character)) {
      groups.set(character, []);
    }
    groups.get(character).push(model);
  });
  return [...groups.entries()].map(([character, models]) => ({
    character,
    models: models.sort((left, right) => String(left.linkedEpisode.episode).localeCompare(String(right.linkedEpisode.episode), undefined, { numeric: true }))
  }));
}

window.linkedEpisodeAdvisor = {
  finalDate: LINKED_EPISODE_FINAL_DATE,
  personaUnlocks: LINKED_EPISODE_UNLOCKS,
  dateToNum,
  compareDates,
  daysBetween,
  formatDate,
  getEpisode,
  getModels,
  getActionableModels,
  getTopModelForDate,
  getBlockedImportantModel,
  getRecommendationWhy,
  getAvailability,
  getCharacterGroups,
  compareModels
};
})();
