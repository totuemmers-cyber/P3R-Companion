(() => {
const SOCIAL_LINK_RULE_OVERRIDES = {
  Magician: {
    availableDays: [2, 4, 5],
    schoolLink: true
  },
  Priestess: {
    availableDays: [1, 3, 4, 6],
    schoolLink: true,
    unlockDate: { month: 6, day: 22 },
    statRequirements: { courage: 6 },
    prerequisites: [
      { type: 'started', arcana: 'Fortune', label: 'Start Keisuke (Fortune) first.' }
    ],
    manualUnlock: true,
    setupLabel: 'After June 22, talk to Fuuka on 2F once Courage is maxed and Fortune has started.'
  },
  Empress: {
    schoolLink: true,
    preExamExceptionRanges: [
      { from: { month: 12, day: 7 }, to: { month: 12, day: 13 } }
    ]
  },
  Emperor: {
    availableDays: [1, 2, 3, 4, 5, 6],
    schoolLink: true,
    blockedRanges: [
      { from: { month: 11, day: 3 }, to: { month: 11, day: 29 }, label: 'Student Council is unavailable during this story period.' }
    ],
    manualUnlock: true,
    setupLabel: 'Join the Student Council to start Hidetoshi.'
  },
  Hierophant: {
    availableDays: [0, 2, 3, 4, 5, 6],
    manualUnlock: true,
    setupLabel: 'Bring the Persimmon Leaf back to the old couple to start the link.'
  },
  Lovers: {
    availableDays: [1, 3, 4, 6],
    schoolLink: true,
    unlockDate: { month: 7, day: 24 },
    statRequirements: { charm: 6 },
    manualUnlock: true,
    setupLabel: 'After Yakushima, talk to Yukari in the classroom once Charm is maxed.'
  },
  Chariot: {
    availableDays: [1, 2, 4, 5],
    schoolLink: true,
    manualUnlock: true,
    setupLabel: 'Join the Track Team to start Kazushi.'
  },
  Justice: {
    availableDays: [2, 4, 6],
    schoolLink: true,
    unlockDate: { month: 4, day: 27 },
    statRequirements: {},
    prerequisites: [
      { type: 'started', arcana: 'Emperor', label: 'Start Hidetoshi (Emperor) first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Talk to Chihiro on multiple separate school days before the link can start.'
  },
  Hermit: {
    availableDays: [0],
    extraAvailableDates: [
      { month: 4, day: 29 },
      { month: 5, day: 4 },
      { month: 5, day: 5 },
      { month: 9, day: 21 },
      { month: 9, day: 22 },
      { month: 9, day: 23 },
      { month: 11, day: 23 },
      { month: 12, day: 23 },
      { month: 1, day: 11 }
    ],
    timeSlot: 'day',
    endDate: null
  },
  Fortune: {
    availableDays: [2, 3, 4],
    schoolLink: true,
    manualUnlock: true,
    setupLabel: 'Join the Art Club to start Keisuke.'
  },
  Strength: {
    availableDays: [3, 6],
    schoolLink: true,
    statRequirements: {},
    prerequisites: [
      { type: 'rank', arcana: 'Chariot', minRank: 2, label: 'Raise Kazushi (Chariot) to Rank 2 first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Ask Yuko to walk home after Track Team opens her route.'
  },
  Hanged: {
    availableDays: [1, 3, 6],
    manualUnlock: true,
    setupLabel: 'Give Maiko Weird Takoyaki and Mad Bull on separate visits to begin the link.'
  },
  Temperance: {
    availableDays: [2, 3, 5],
    schoolLink: true,
    statRequirements: { academics: 2 },
    prerequisites: [
      { type: 'rank', arcana: 'Hierophant', minRank: 3, label: 'Raise the old couple (Hierophant) to Rank 3 first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Read the Home Economics room sign and meet Bebe there.'
  },
  Devil: {
    availableDays: [2, 6],
    statRequirements: { charm: 4 },
    prerequisites: [
      { type: 'rank', arcana: 'Hermit', minRank: 4, label: 'Raise Maya (Hermit) to Rank 4 first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Tanaka requires the Paulownia Mall money setup before the link officially starts.'
  },
  Tower: {
    availableDays: [4, 5, 6, 0],
    statRequirements: { courage: 4 },
    prerequisites: [
      { type: 'rank', arcana: 'Strength', minRank: 4, label: 'Raise Yuko (Strength) to Rank 4 first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Mutatsu requires the Club Escapade drink-order setup after Yuko mentions him; some guides note a Rank 3 Strength rewrite, but this app uses Rank 4.'
  },
  Star: {
    availableDays: [3, 5, 0],
    statRequirements: { courage: 4 },
    prerequisites: [
      { type: 'started', arcana: 'Chariot', label: 'Join the Track Team first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Mamoru only starts after the track meet story event has happened.'
  },
  Moon: {
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    statRequirements: { charm: 2 },
    prerequisites: [
      { type: 'rank', arcana: 'Magician', minRank: 3, label: 'Raise Kenji (Magician) to Rank 3 first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Nozomi needs the food quiz and an Odd Morsel before the link officially starts.'
  },
  Sun: {
    availableDays: [0],
    unlockDate: { month: 8, day: 9 },
    statRequirements: { academics: 4 },
    prerequisites: [
      { type: 'rank', arcana: 'Hanged', minRank: 3, label: 'Raise Maiko (Hanged) to Rank 3 first.' }
    ],
    manualUnlock: true,
    setupLabel: 'Akinari needs the Red Fountain Pen after Koromaru joins the dorm.'
  },
  Aeon: {
    availableDays: [5],
    schoolLink: true
  }
};

const SCHOOL_PRE_EXAM_RANGES = [
  { from: { month: 5, day: 11 }, to: { month: 5, day: 17 }, label: 'School links are unavailable the week before exams.' },
  { from: { month: 7, day: 6 }, to: { month: 7, day: 13 }, label: 'School links are unavailable the week before exams.' },
  { from: { month: 10, day: 5 }, to: { month: 10, day: 12 }, label: 'School links are unavailable the week before exams.' },
  { from: { month: 12, day: 7 }, to: { month: 12, day: 13 }, label: 'School links are unavailable the week before exams.' }
];

const SCHOOL_VACATION_RANGES = [
  { from: { month: 7, day: 25 }, to: { month: 8, day: 31 }, label: 'School is not in session during summer break.' },
  { from: { month: 12, day: 24 }, to: { month: 1, day: 7 }, label: 'School is not in session during winter break.' }
];

const SCHOOL_HOLIDAYS = [
  { month: 4, day: 29, label: 'School is not in session on holidays.' },
  { month: 5, day: 4, label: 'School is not in session on holidays.' },
  { month: 5, day: 5, label: 'School is not in session on holidays.' },
  { month: 7, day: 20, label: 'School is not in session on holidays.' },
  { month: 9, day: 21, label: 'School is not in session on holidays.' },
  { month: 9, day: 22, label: 'School is not in session on holidays.' },
  { month: 9, day: 23, label: 'School is not in session on holidays.' },
  { month: 11, day: 3, label: 'School is not in session on holidays.' },
  { month: 11, day: 23, label: 'School is not in session on holidays.' },
  { month: 1, day: 11, label: 'School is not in session on holidays.' }
];

function getSocialLinkAvailabilityCategory(linkOrDays) {
  const days = Array.isArray(linkOrDays) ? linkOrDays : linkOrDays?.availableDays;
  const dayCount = Array.isArray(days) ? new Set(days).size : 0;
  let category = 'story';
  if (dayCount >= 7) {
    category = 'daily';
  } else if (dayCount >= 4) {
    category = 'broad';
  } else if (dayCount === 3) {
    category = 'moderate';
  } else if (dayCount >= 1) {
    category = 'scarce';
  }

  return {
    category,
    dayCount,
    isDaily: category === 'daily',
    isBroad: category === 'broad',
    isModerate: category === 'moderate',
    isScarce: category === 'scarce'
  };
}

function formatSocialLinkAvailabilityCount(linkOrDays, options = {}) {
  const summary = getSocialLinkAvailabilityCategory(linkOrDays);
  const dayWord = summary.dayCount === 1 ? 'day' : 'days';
  if (summary.isDaily) {
    return 'Available daily';
  }
  if (summary.isBroad) {
    return `Available ${summary.dayCount} ${dayWord}/week`;
  }
  if (summary.isModerate) {
    return `Limited schedule (${summary.dayCount} ${dayWord}/week)`;
  }
  if (summary.isScarce) {
    return options.compact
      ? `${summary.dayCount} ${dayWord}/week`
      : `Only ${summary.dayCount} ${dayWord} each week`;
  }
  return 'Story schedule';
}

function dateToNum(date) {
  const month = date.month >= 4 ? date.month : date.month + 12;
  return month * 100 + date.day;
}

function compareDates(left, right) {
  return dateToNum(left) - dateToNum(right);
}

function getDayOfWeek(month, day) {
  const year = month >= 4 ? 2009 : 2010;
  return new Date(year, month - 1, day).getDay();
}

function isDateInRange(date, range) {
  return compareDates(date, range.from) >= 0 && compareDates(date, range.to) <= 0;
}

function cloneLink(base, override) {
  const hasStatRequirements = Object.prototype.hasOwnProperty.call(override, 'statRequirements');
  const hasPrerequisites = Object.prototype.hasOwnProperty.call(override, 'prerequisites');
  const hasAvailableDays = Object.prototype.hasOwnProperty.call(override, 'availableDays');
  const hasExtraDates = Object.prototype.hasOwnProperty.call(override, 'extraAvailableDates');
  const hasBlockedRanges = Object.prototype.hasOwnProperty.call(override, 'blockedRanges');
  const hasPreExamExceptions = Object.prototype.hasOwnProperty.call(override, 'preExamExceptionRanges');
  return {
    ...base,
    ...override,
    statRequirements: hasStatRequirements
      ? { ...(override.statRequirements || {}) }
      : { ...(base.statRequirements || {}) },
    prerequisites: hasPrerequisites ? [...(override.prerequisites || [])] : [...(base.prerequisites || [])],
    availableDays: hasAvailableDays ? [...(override.availableDays || [])] : [...(base.availableDays || [])],
    extraAvailableDates: hasExtraDates ? [...(override.extraAvailableDates || [])] : [...(base.extraAvailableDates || [])],
    blockedRanges: hasBlockedRanges ? [...(override.blockedRanges || [])] : [...(base.blockedRanges || [])],
    preExamExceptionRanges: hasPreExamExceptions
      ? [...(override.preExamExceptionRanges || [])]
      : [...(base.preExamExceptionRanges || [])]
  };
}

function getSocialLinkDefinition(arcana) {
  const base = SOCIAL_LINKS[arcana];
  if (!base) {
    return null;
  }
  const override = SOCIAL_LINK_RULE_OVERRIDES[arcana] || {};
  return cloneLink(base, override);
}

function getGlobalBlockedReason(date, timeSlot) {
  const dayNumber = dateToNum(date);
  for (const blocked of BLOCKED_DATES) {
    if (dayNumber >= dateToNum(blocked.from) && dayNumber <= dateToNum(blocked.to)) {
      if (blocked.block === 'both' || blocked.block === timeSlot) {
        return blocked.reason;
      }
    }
  }
  return '';
}

function getSnapshotValue(snapshot, path, fallback) {
  try {
    return path.reduce((acc, key) => acc[key], snapshot) ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function meetsPrerequisite(prerequisite, snapshot) {
  const ranks = getSnapshotValue(snapshot, ['socialLinks', 'ranks'], {});
  switch (prerequisite.type) {
    case 'rank':
      return (ranks[prerequisite.arcana] || 0) >= prerequisite.minRank;
    case 'started':
      return (ranks[prerequisite.arcana] || 0) >= 1;
    case 'stat':
      return (getSnapshotValue(snapshot, ['profile', 'stats', prerequisite.stat], 1)) >= prerequisite.minValue;
    default:
      return true;
  }
}

function getPrerequisiteReason(link, snapshot) {
  for (const prerequisite of link.prerequisites || []) {
    if (!meetsPrerequisite(prerequisite, snapshot)) {
      return prerequisite.label || 'Missing prerequisite.';
    }
  }
  return '';
}

function isExtraAvailableDate(link, date) {
  return (link.extraAvailableDates || []).some((entry) => entry.month === date.month && entry.day === date.day);
}

function isSchoolPreExamBlocked(link, date) {
  if (!link.schoolLink) {
    return '';
  }
  const hasException = (link.preExamExceptionRanges || []).some((range) => isDateInRange(date, range));
  if (hasException) {
    return '';
  }
  const match = SCHOOL_PRE_EXAM_RANGES.find((range) => isDateInRange(date, range));
  return match ? match.label : '';
}

function isSchoolVacationBlocked(link, date) {
  if (!link.schoolLink) {
    return '';
  }
  const match = SCHOOL_VACATION_RANGES.find((range) => isDateInRange(date, range));
  return match ? match.label : '';
}

function isSchoolHolidayBlocked(link, date) {
  if (!link.schoolLink) {
    return '';
  }
  const match = SCHOOL_HOLIDAYS.find((entry) => entry.month === date.month && entry.day === date.day);
  return match ? match.label : '';
}

function getRangeBlockedReason(link, date) {
  const match = (link.blockedRanges || []).find((range) => isDateInRange(date, range));
  return match ? match.label : '';
}

function statsMet(link, snapshot) {
  return Object.entries(link.statRequirements || {}).every(
    ([stat, requirement]) => getSnapshotValue(snapshot, ['profile', 'stats', stat], 1) >= requirement
  );
}

function getStatBlockedReason(link, snapshot) {
  const unmet = Object.entries(link.statRequirements || {}).filter(
    ([stat, requirement]) => getSnapshotValue(snapshot, ['profile', 'stats', stat], 1) < requirement
  );
  if (!unmet.length) {
    return '';
  }
  return unmet
    .map(([stat, requirement]) => `${capitalize(stat)} ${requirement} required`)
    .join(', ');
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSocialLinkAvailability(arcana, snapshot, date = snapshot.profile.gameDate, timeSlot = null) {
  const link = getSocialLinkDefinition(arcana);
  if (!link) {
    return { status: 'missing', available: false, actionable: false, link: null, reason: 'Missing link data.' };
  }

  const rank = getSnapshotValue(snapshot, ['socialLinks', 'ranks', arcana], 0);
  if (link.automatic) {
    return { status: 'automatic', available: false, actionable: false, link, rank, reason: 'Automatic story link.' };
  }
  if (rank >= 10) {
    return { status: 'maxed', available: false, actionable: false, link, rank, reason: 'Already maxed.' };
  }
  if (timeSlot && link.timeSlot !== timeSlot) {
    return { status: 'wrong_timeslot', available: false, actionable: false, link, rank, reason: 'Wrong time slot.' };
  }
  if (compareDates(date, link.unlockDate) < 0) {
    return { status: 'before_unlock', available: false, actionable: false, link, rank, reason: `Unlocks ${MONTH_NAMES[link.unlockDate.month]} ${link.unlockDate.day}.` };
  }
  if (link.endDate && compareDates(date, link.endDate) > 0) {
    return { status: 'expired', available: false, actionable: false, link, rank, reason: 'Link window has already ended.' };
  }

  const prerequisiteReason = getPrerequisiteReason(link, snapshot);
  if (prerequisiteReason) {
    return { status: 'locked_prerequisite', available: false, actionable: false, link, rank, reason: prerequisiteReason };
  }

  const statsReason = getStatBlockedReason(link, snapshot);
  if (statsReason) {
    return { status: 'locked_stats', available: false, actionable: false, link, rank, reason: statsReason };
  }

  const globalBlocked = getGlobalBlockedReason(date, link.timeSlot);
  if (globalBlocked) {
    return { status: 'blocked_global', available: false, actionable: false, link, rank, reason: globalBlocked };
  }

  const preExamBlocked = isSchoolPreExamBlocked(link, date);
  if (preExamBlocked) {
    return { status: 'blocked_pre_exam', available: false, actionable: false, link, rank, reason: preExamBlocked };
  }

  const vacationBlocked = isSchoolVacationBlocked(link, date);
  if (vacationBlocked) {
    return { status: 'blocked_vacation', available: false, actionable: false, link, rank, reason: vacationBlocked };
  }

  const holidayBlocked = isSchoolHolidayBlocked(link, date);
  if (holidayBlocked) {
    return { status: 'blocked_holiday', available: false, actionable: false, link, rank, reason: holidayBlocked };
  }

  const rangeBlocked = getRangeBlockedReason(link, date);
  if (rangeBlocked) {
    return { status: 'blocked_range', available: false, actionable: false, link, rank, reason: rangeBlocked };
  }

  const dayOfWeek = getDayOfWeek(date.month, date.day);
  if (!link.availableDays.includes(dayOfWeek) && !isExtraAvailableDate(link, date)) {
    return { status: 'unavailable_weekday', available: false, actionable: false, link, rank, reason: 'Not available on this day of the week.' };
  }

  if (rank === 0 && link.manualUnlock) {
    return {
      status: 'setup_needed',
      available: false,
      actionable: true,
      link,
      rank,
      reason: link.setupLabel || 'This Social Link still needs its start event.'
    };
  }

  return {
    status: 'available',
    available: true,
    actionable: true,
    link,
    rank,
    reason: '',
    statsMet: statsMet(link, snapshot)
  };
}

window.getSocialLinkDefinition = getSocialLinkDefinition;
window.getSocialLinkAvailability = getSocialLinkAvailability;
window.getSocialLinkAvailabilityCategory = getSocialLinkAvailabilityCategory;
window.formatSocialLinkAvailabilityCount = formatSocialLinkAvailabilityCount;
window.getSocialLinkBlockedReason = getGlobalBlockedReason;
window.getSocialLinkDayOfWeek = getDayOfWeek;
window.compareSocialDates = compareDates;
})();
