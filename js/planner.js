(() => {
let plannerRoot;
let plannerStore;
let initialized = false;
let renderQueued = false;

const MONTH_NAME_TO_NUM = {
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
  January: 1
};

const PERSONA_COUNTS_BY_ARCANA = {};
Object.entries(PERSONAS).forEach(([name, persona]) => {
  if (!PERSONA_COUNTS_BY_ARCANA[persona.race]) {
    PERSONA_COUNTS_BY_ARCANA[persona.race] = [];
  }
  PERSONA_COUNTS_BY_ARCANA[persona.race].push({
    name,
    lvl: persona.lvl,
    special: Boolean(SPECIAL_RECIPES[name])
  });
});
Object.values(PERSONA_COUNTS_BY_ARCANA).forEach((entries) => {
  entries.sort((left, right) => left.lvl - right.lvl || left.name.localeCompare(right.name));
});

const FULL_MOON_SCHEDULE = FULL_MOON_DATES.map((entry) => ({
  ...entry,
  parsedDate: parseMonthDayLabel(entry.date),
  primaryStrategy: entry.names.length > 0 ? BOSS_STRATS[entry.names[0]] : null
}));

const GATEKEEPERS = Object.entries(ENEMY_RAW)
  .map(([name, data]) => {
    const area = data.area || '';
    const blockMatch = area.match(/^(Thebel|Arqa|Yabbashah|Tziah|Harabah|Adamah)/i);
    const floorMatch = area.match(/(\d+)$/);
    if (!blockMatch || !floorMatch) {
      return null;
    }
    return {
      name,
      block: blockMatch[1].toLowerCase(),
      floor: Number(floorMatch[1]),
      lvl: data.lvl || 1
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.floor - right.floor || left.name.localeCompare(right.name));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSnapshot() {
  return plannerStore.getState();
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

function isDeadlineStale(item, snapshot) {
  if (snapshot.objectives?.[item.id]) {
    return false;
  }
  const deadlineDate = item.deadline ? parseMonthDayLabel(item.deadline) : null;
  return Boolean(deadlineDate && daysBetween(snapshot.profile.gameDate, deadlineDate) < 0);
}

function formatDate(date) {
  return `${MONTH_NAMES[date.month]} ${date.day}`;
}

function parseMonthDayLabel(label) {
  if (!label || typeof label !== 'string') {
    return null;
  }
  const numericParts = label.replace(',', '').split('/');
  if (numericParts.length === 2) {
    const month = Number(numericParts[0]);
    const day = Number(numericParts[1]);
    if (Number.isFinite(month) && Number.isFinite(day)) {
      return { month, day };
    }
  }
  const parts = label.replace(',', '').split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  const month = MONTH_NAME_TO_NUM[parts[0]];
  const day = Number(parts[1]);
  if (!month || !Number.isFinite(day)) {
    return null;
  }
  return { month, day };
}

function getCurrentBlock(floor) {
  return BLOCKS.find((entry) => floor >= entry.fMin && floor <= entry.fMax) || null;
}

function getRosterSet(snapshot) {
  return new Set(snapshot.roster || []);
}

function getRosterMatchForArcana(arcana, snapshot) {
  return snapshot.roster.find((name) => PERSONAS[name] && PERSONAS[name].race === arcana) || null;
}

function getSocialLinkAdvisor() {
  return window.socialLinkAdvisor || null;
}

function getSocialLinkFocusMode() {
  return window.p3rApp?.getSocialLinkFocusMode ? window.p3rApp.getSocialLinkFocusMode() : 'balanced';
}

function getLinkExtra(arcana) {
  if (typeof SOCIAL_LINK_EXTRAS === 'undefined') {
    return null;
  }
  return SOCIAL_LINK_EXTRAS[arcana] || null;
}

function getLink(arcana) {
  if (typeof window.getSocialLinkDefinition === 'function') {
    return window.getSocialLinkDefinition(arcana);
  }
  return SOCIAL_LINKS[arcana];
}

function getStatGuide(stat) {
  if (typeof SOCIAL_STAT_ACTIVITY_GUIDES === 'undefined') {
    return [];
  }
  return SOCIAL_STAT_ACTIVITY_GUIDES[stat] || [];
}

function getBlockedReason(month, day, timeSlot) {
  if (typeof window.getSocialLinkBlockedReason === 'function') {
    return window.getSocialLinkBlockedReason({ month, day }, timeSlot);
  }
  const dayNumber = dateToNum({ month, day });
  for (const blocked of BLOCKED_DATES) {
    if (dayNumber >= dateToNum(blocked.from) && dayNumber <= dateToNum(blocked.to)) {
      if (blocked.block === 'both' || blocked.block === timeSlot) {
        return blocked.reason;
      }
    }
  }
  return null;
}

function statsMet(link, snapshot) {
  return Object.entries(link.statRequirements).every(
    ([stat, requirement]) => (snapshot.profile.stats[stat] || 1) >= requirement
  );
}

function getDayOfWeek(month, day) {
  if (typeof window.getSocialLinkDayOfWeek === 'function') {
    return window.getSocialLinkDayOfWeek(month, day);
  }
  const year = month >= 4 ? 2009 : 2010;
  return new Date(year, month - 1, day).getDay();
}

function scoreLink(arcana, snapshot) {
  const link = getLink(arcana);
  const currentRank = snapshot.socialLinks.ranks[arcana] || 0;
  if (!link || currentRank >= 10) {
    return { score: -1, reasons: [] };
  }

  let score = 0;
  const reasons = [];
  const extra = getLinkExtra(arcana);
  const personaCount = PERSONA_COUNTS_BY_ARCANA[arcana]?.length || 0;

  score += Math.round((10 - currentRank) * 2);
  if (currentRank === 0) {
    reasons.push('Not started yet');
  } else if (currentRank >= 7) {
    reasons.push(`Rank ${currentRank}/10 - close to max`);
    score += 8;
  }

  if (personaCount > 0) {
    score += Math.round((personaCount / 12) * 10);
  }

  if (link.endDate) {
    const daysLeft = daysBetween(snapshot.profile.gameDate, link.endDate);
    if (daysLeft >= 0 && daysLeft <= 30) {
      score += Math.round(15 * (1 - daysLeft / 30));
      reasons.push(`${daysLeft} day${daysLeft === 1 ? '' : 's'} to cutoff`);
    }
  }

  if (extra?.deadline) {
    score += 8;
    reasons.push(extra.deadline);
  }

  if (link.availableDays.length > 0 && link.availableDays.length <= 2) {
    score += 5;
    reasons.push(`${link.availableDays.length} day${link.availableDays.length === 1 ? '' : 's'} per week`);
  }

  if (!statsMet(link, snapshot)) {
    score -= 50;
    const gate = Object.entries(link.statRequirements)
      .filter(([stat, requirement]) => (snapshot.profile.stats[stat] || 1) < requirement)
      .map(([stat, requirement]) => `${stat} ${requirement}`)
      .join(', ');
    reasons.push(`Locked by ${gate}`);
  }

  const rosterMatch = getRosterMatchForArcana(arcana, snapshot);
  if (rosterMatch) {
    score += 5;
    reasons.push(`Have ${rosterMatch} for arcana bonus`);
  } else if ((snapshot.roster || []).length > 0) {
    score -= 2;
    reasons.push(`No ${arcana} persona in roster`);
  }

  return { score, reasons: reasons.slice(0, 3) };
}

function getAvailableLinks(snapshot, timeSlot) {
  const date = snapshot.profile.gameDate;
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
    const result = scoreLink(arcana, snapshot);
    results.push({
      arcana,
      link,
      available: availability.available,
      actionable: availability.actionable,
      score: result.score,
      reasons: result.reasons
    });
  });
  return results.sort((left, right) => right.score - left.score);
}

function getStatBottlenecks(snapshot) {
  const entries = [];
  ARCANA_LIST.forEach((arcana) => {
    const link = getLink(arcana);
    if (!link || link.automatic || (snapshot.socialLinks.ranks[arcana] || 0) >= 10) {
      return;
    }
    Object.entries(link.statRequirements).forEach(([stat, requirement]) => {
      const current = snapshot.profile.stats[stat] || 1;
      if (current < requirement) {
        entries.push({
          stat,
          current,
          requirement,
          delta: requirement - current,
          arcana,
          character: link.character
        });
      }
    });
  });
  return entries.sort((left, right) => left.delta - right.delta || left.requirement - right.requirement);
}

function getNextGatekeeper(floor, blockId) {
  return GATEKEEPERS.find((entry) => entry.block === blockId && entry.floor > floor) || null;
}

function getNearestObjective(snapshot, floor, blockId) {
  if (typeof TARTARUS_OBJECTIVES === 'undefined') {
    return null;
  }
  const currentDate = snapshot.profile.gameDate;
  return TARTARUS_OBJECTIVES
    .filter(
      (objective) => {
        const availableDate = objective.available ? parseMonthDayLabel(objective.available) : null;
        return (
        objective.block === blockId &&
        objective.floor >= floor &&
        !snapshot.objectives?.[objective.id] &&
        !isDeadlineStale(objective, snapshot) &&
        (!availableDate || compareDates(currentDate, availableDate) >= 0)
        );
      }
    )
    .sort((left, right) => left.floor - right.floor || left.title.localeCompare(right.title))[0] || null;
}

function getUrgentObjective(snapshot) {
  if (typeof TARTARUS_OBJECTIVES === 'undefined') {
    return null;
  }
  const currentDate = snapshot.profile.gameDate;
  return TARTARUS_OBJECTIVES
    .map((objective) => {
      if (snapshot.objectives?.[objective.id]) {
        return null;
      }
      if (isDeadlineStale(objective, snapshot)) {
        return null;
      }
      const availableDate = objective.available ? parseMonthDayLabel(objective.available) : null;
      if (availableDate && compareDates(currentDate, availableDate) < 0) {
        return null;
      }
      const deadlineDate = objective.deadline ? parseMonthDayLabel(objective.deadline) : null;
      if (!deadlineDate) {
        return null;
      }
      const daysLeft = daysBetween(currentDate, deadlineDate);
      let urgency = 0;
      if (daysLeft <= 3) {
        urgency = 80 - Math.max(daysLeft, 0);
      } else if (daysLeft <= 10) {
        urgency = 40 - daysLeft;
      }
      if (urgency <= 0) {
        return null;
      }
      return {
        ...objective,
        daysLeft,
        urgency
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.urgency - left.urgency || left.floor - right.floor)[0] || null;
}

function getUrgentRequest(snapshot) {
  if (typeof ELIZABETH_REQUESTS === 'undefined') {
    return null;
  }
  const currentDate = snapshot.profile.gameDate;
  return ELIZABETH_REQUESTS
    .map((request) => {
      if (snapshot.objectives?.[request.id]) {
        return null;
      }
      if (isDeadlineStale(request, snapshot)) {
        return null;
      }
      const availableDate = request.available ? parseMonthDayLabel(request.available) : null;
      if (availableDate && compareDates(currentDate, availableDate) < 0) {
        const opensIn = daysBetween(currentDate, availableDate);
        if (opensIn > 3) {
          return null;
        }
        return {
          ...request,
          daysLeft: opensIn,
          urgency: 18 - opensIn,
          statusLabel: `opens in ${opensIn} day${opensIn === 1 ? '' : 's'}`
        };
      }
      const deadlineDate = request.deadline ? parseMonthDayLabel(request.deadline) : null;
      if (!deadlineDate) {
        return null;
      }
      const daysLeft = daysBetween(currentDate, deadlineDate);
      if (daysLeft > 7) {
        return null;
      }
      return {
        ...request,
        daysLeft,
        urgency: 70 - Math.max(daysLeft, 0),
        statusLabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.urgency - left.urgency || left.number - right.number)[0] || null;
}

function getNextFullMoon(snapshot) {
  const currentDate = snapshot.profile.gameDate;
  return (
    FULL_MOON_SCHEDULE.find((entry) => entry.parsedDate && compareDates(currentDate, entry.parsedDate) <= 0) ||
    null
  );
}

function getLevelReadiness(currentLevel, recommendedLevel) {
  if (!recommendedLevel || !currentLevel) {
    return null;
  }
  const diff = currentLevel - recommendedLevel;
  if (diff <= -5) {
    return {
      tone: 'critical',
      text: `Current Lv ${currentLevel} is well below the comfort point (around Lv ${recommendedLevel}).`
    };
  }
  if (diff < 0) {
    return {
      tone: 'warning',
      text: `Current Lv ${currentLevel} is slightly below the comfort point (around Lv ${recommendedLevel}).`
    };
  }
  if (diff <= 3) {
    return {
      tone: 'ready',
      text: `Current Lv ${currentLevel} is on pace for a safe attempt.`
    };
  }
  return {
    tone: 'ahead',
    text: `Current Lv ${currentLevel} is ahead of the recommended pace.`
  };
}

function extractPersonaName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return '';
  }
  return rawName.split(' (')[0].trim();
}

function findSuggestedPersonaForArcana(arcana, snapshot) {
  const roster = getRosterSet(snapshot);
  const candidates = PERSONA_COUNTS_BY_ARCANA[arcana] || [];
  return candidates.find((entry) => !entry.special && entry.lvl <= snapshot.profile.playerLevel && !roster.has(entry.name)) || null;
}

function isFusionTargetRecommendable(name, snapshot, rosterSet = getRosterSet(snapshot)) {
  const persona = PERSONAS[name];
  return Boolean(persona && persona.lvl <= snapshot.profile.playerLevel && !rosterSet.has(name));
}

function getFusionOpportunity(snapshot, dayPick, nextFullMoon) {
  const rosterSet = getRosterSet(snapshot);

  if (dayPick && !getRosterMatchForArcana(dayPick.arcana, snapshot)) {
    const target = findSuggestedPersonaForArcana(dayPick.arcana, snapshot);
    if (target) {
      return {
        title: `Fuse a ${dayPick.arcana} persona`,
        copy: `${dayPick.link.character} is your best current ${dayPick.link.timeSlot} Social Link pick, but you do not have a matching arcana persona for the bonus points.`,
        targetName: target.name,
        lines: [
          `Suggested starter target: ${target.name} (Lv ${target.lvl})`,
          `Carrying any ${dayPick.arcana} persona boosts rank progress.`
        ]
      };
    }
  }

  const bossPersona = nextFullMoon?.primaryStrategy?.personas
    ?.map(extractPersonaName)
    .find((name) => isFusionTargetRecommendable(name, snapshot, rosterSet));
  if (bossPersona) {
    return {
      title: `Prep ${bossPersona} for the next full moon`,
      copy: `${nextFullMoon.boss} already has curated persona guidance. Building one of those picks is the cleanest next fusion step.`,
      targetName: bossPersona,
      lines: [
        `${bossPersona} is called out in the current boss prep notes.`,
        `Use Fusion Planner to find the shortest path from your roster.`
      ]
    };
  }

  return null;
}

function buildWarnings(snapshot, context) {
  const warnings = [];
  const currentLevel = snapshot.profile.playerLevel;

  if (context.urgentObjective) {
    warnings.push({
      tone: 'warning',
      text: `${context.urgentObjective.title} expires in ${context.urgentObjective.daysLeft} day${context.urgentObjective.daysLeft === 1 ? '' : 's'}.`,
      completeId: context.urgentObjective.id
    });
  }

  if (context.highPressureLinks.length > 0) {
    const top = context.highPressureLinks[0];
    warnings.push({
      tone: 'warning',
      text: `${top.link.character} is currently one of your most fragile Social Links (${top.plannerReason}).`
    });
  }

  if (context.nextGatekeeper) {
    const readiness = getLevelReadiness(currentLevel, context.nextGatekeeper.lvl);
    if (readiness && (readiness.tone === 'critical' || readiness.tone === 'warning')) {
      warnings.push({
        tone: readiness.tone,
        text: `${context.nextGatekeeper.name} on ${context.nextGatekeeper.floor}F: ${readiness.text}`
      });
    }
  }

  if (context.nextFullMoon?.primaryStrategy?.recLevel) {
    const readiness = getLevelReadiness(currentLevel, context.nextFullMoon.primaryStrategy.recLevel);
    if (readiness && (readiness.tone === 'critical' || readiness.tone === 'warning')) {
      warnings.push({
        tone: readiness.tone,
        text: `${context.nextFullMoon.boss} (${context.nextFullMoon.date}): ${readiness.text}`
      });
    }
  }

  if (context.dayPick && !getRosterMatchForArcana(context.dayPick.arcana, snapshot)) {
    warnings.push({
      tone: 'neutral',
      text: `You do not have a ${context.dayPick.arcana} persona for ${context.dayPick.link.character}'s arcana bonus.`
    });
  }

  return warnings.slice(0, 4);
}

function choosePrimaryAction(snapshot, context) {
  const currentFloor = snapshot.profile.currentFloor;

  if (context.urgentObjective) {
    return {
      kicker: 'Highest Priority',
      title: `Push Tartarus for ${context.urgentObjective.title}`,
      copy: `This objective is your most urgent deadline item and is tied to ${context.urgentObjective.floor}F.`,
      reasons: [
        `${context.urgentObjective.daysLeft} day${context.urgentObjective.daysLeft === 1 ? '' : 's'} remain before the deadline.`,
        `Reward: ${context.urgentObjective.reward}.`
      ],
      action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: context.urgentObjective.floor },
      completeId: context.urgentObjective.id
    };
  }

  if (
    context.nextFullMoon &&
    context.nextFullMoon.primaryStrategy?.recLevel &&
    daysBetween(snapshot.profile.gameDate, context.nextFullMoon.parsedDate) <= 7 &&
    snapshot.profile.playerLevel < context.nextFullMoon.primaryStrategy.recLevel
  ) {
    return {
      kicker: 'Highest Priority',
      title: `Prep for ${context.nextFullMoon.boss}`,
      copy: `The next Full Moon is close enough that readiness should trump filler progress.`,
      reasons: [
        `${context.nextFullMoon.date} is only ${daysBetween(snapshot.profile.gameDate, context.nextFullMoon.parsedDate)} day${daysBetween(snapshot.profile.gameDate, context.nextFullMoon.parsedDate) === 1 ? '' : 's'} away.`,
        `Recommended comfort level is around Lv ${context.nextFullMoon.primaryStrategy.recLevel}.`
      ],
      action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: currentFloor }
    };
  }

  if (context.dayPick) {
    return {
      kicker: 'Best Use of Today',
      title: `Spend time with ${context.dayPick.link.character}`,
      copy: `This is your strongest available daytime link from the current date, stats, and roster.`,
      reasons: [context.dayPick.plannerReason || 'High current social value.'],
      action: { type: 'social-links', label: 'Open Social Links' }
    };
  }

  if (context.statFallback) {
    return {
      kicker: 'Best Fallback',
      title: `Raise ${capitalize(context.statFallback.stat)}`,
      copy: context.statFallback.note,
      reasons: [
        `${context.statFallback.character} is blocked until ${capitalize(context.statFallback.stat)} reaches ${context.statFallback.requirement}.`,
        'Use a stat activity now so later school-day pressure is easier to manage.'
      ],
      action: { type: 'social-links', label: 'Open Social Links' }
    };
  }

  if (context.nearestObjective || context.nextGatekeeper) {
    return {
      kicker: 'Best Progress Push',
      title: `Climb deeper into ${context.currentBlock.name}`,
      copy: `Your next Tartarus milestone is already in this block and worth planning around.`,
      reasons: [
        context.nearestObjective
          ? `${context.nearestObjective.title} sits on ${context.nearestObjective.floor}F.`
          : 'No immediate floor objective, but progression is still ahead of you.',
        context.nextGatekeeper
          ? `${context.nextGatekeeper.name} blocks ${context.nextGatekeeper.floor}F.`
          : 'No further gatekeeper remains in this block.'
      ],
      action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: currentFloor }
    };
  }

  return {
    kicker: 'Stable State',
    title: 'No major crisis detected',
    copy: 'You are currently free to pursue value picks, roster cleanup, or efficient stat growth.',
    reasons: ['Use the Planner cards below to choose the cleanest next improvement.'],
    action: { type: 'social-links', label: 'Open Social Links' }
  };
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getActionSystem(action) {
  if (!action) {
    return 'Planner';
  }
  if (action.type === 'tartarus-floor') {
    return 'Tartarus';
  }
  if (action.type === 'velvet-target') {
    return 'Velvet Room';
  }
  if (action.type === 'social-links') {
    return 'Social Links';
  }
  if (action.type === 'requests') {
    return 'Requests';
  }
  return 'Planner';
}

function createQueueItem({ system, tone = 'normal', title, copy, meta, action, score, completeId = null }) {
  return {
    system,
    tone,
    title,
    copy,
    meta,
    action,
    score,
    completeId
  };
}

function buildActionQueue(snapshot, context, primaryAction) {
  const currentFloor = snapshot.profile.currentFloor;
  const queue = [
    createQueueItem({
      system: getActionSystem(primaryAction.action),
      tone: primaryAction.kicker === 'Highest Priority' ? 'critical' : 'featured',
      title: primaryAction.title,
      copy: primaryAction.copy,
      meta: primaryAction.kicker,
      action: primaryAction.action,
      score: 100
    })
  ];

  if (context.urgentRequest) {
    queue.push(
      createQueueItem({
        system: 'Requests',
        tone: 'warning',
        title: `Request #${context.urgentRequest.number}: ${context.urgentRequest.title}`,
        copy: `${context.urgentRequest.statusLabel}. Reward: ${context.urgentRequest.reward}.`,
        meta: context.urgentRequest.systemLabel || context.urgentRequest.categoryLabel,
        action: { type: 'requests', label: 'Open Requests' },
        score: context.urgentRequest.urgency,
        completeId: context.urgentRequest.id
      })
    );
  }

  if (context.urgentObjective) {
    queue.push(
      createQueueItem({
        system: 'Tartarus',
        tone: 'warning',
        title: context.urgentObjective.title,
        copy: `${context.urgentObjective.daysLeft} day${context.urgentObjective.daysLeft === 1 ? '' : 's'} left for ${context.urgentObjective.floor}F. Reward: ${context.urgentObjective.reward}.`,
        meta: 'Deadline objective',
        action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: context.urgentObjective.floor },
        score: context.urgentObjective.urgency,
        completeId: context.urgentObjective.id
      })
    );
  } else if (context.nearestObjective) {
    queue.push(
      createQueueItem({
        system: 'Tartarus',
        title: context.nearestObjective.title,
        copy: `Next tracked floor objective is on ${context.nearestObjective.floor}F in ${context.currentBlock?.name || 'Tartarus'}.`,
        meta: 'Floor objective',
        action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: context.nearestObjective.floor },
        score: 45,
        completeId: context.nearestObjective.id
      })
    );
  }

  if (context.dayPick) {
    queue.push(
      createQueueItem({
        system: 'Social Links',
        title: `Day: ${context.dayPick.link.character}`,
        copy: context.dayPick.plannerReason || 'Best current daytime social-link value.',
        meta: `${context.dayPick.arcana} Rank ${context.dayPick.rank}/10`,
        action: { type: 'social-links', label: 'Open Social Links' },
        score: 58
      })
    );
  }

  if (context.nightPick) {
    queue.push(
      createQueueItem({
        system: 'Social Links',
        title: `Night: ${context.nightPick.link.character}`,
        copy: context.nightPick.plannerReason || 'Best current evening social-link value.',
        meta: `${context.nightPick.arcana} Rank ${context.nightPick.rank}/10`,
        action: { type: 'social-links', label: 'Open Social Links' },
        score: 54
      })
    );
  } else if (context.statFallback) {
    queue.push(
      createQueueItem({
        system: 'Social Stats',
        title: `Raise ${capitalize(context.statFallback.stat)}`,
        copy: context.statFallback.note,
        meta: `${context.statFallback.character} gate`,
        action: { type: 'social-links', label: 'Open Social Links' },
        score: 50
      })
    );
  }

  if (context.fusionOpportunity) {
    queue.push(
      createQueueItem({
        system: 'Velvet Room',
        title: context.fusionOpportunity.title,
        copy: context.fusionOpportunity.copy,
        meta: context.fusionOpportunity.targetName || 'Fusion prep',
        action: context.fusionOpportunity.targetName
          ? { type: 'velvet-target', label: 'Open Fusion Planner', target: context.fusionOpportunity.targetName }
          : null,
        score: 48
      })
    );
  }

  if (context.nextGatekeeper) {
    queue.push(
      createQueueItem({
        system: 'Tartarus',
        title: `${context.nextGatekeeper.name} on ${context.nextGatekeeper.floor}F`,
        copy: getLevelReadiness(snapshot.profile.playerLevel, context.nextGatekeeper.lvl)?.text || 'Next gatekeeper checkpoint is ahead.',
        meta: 'Gatekeeper prep',
        action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: currentFloor },
        score: 42
      })
    );
  } else if (context.nextFullMoon) {
    queue.push(
      createQueueItem({
        system: 'Tartarus',
        title: `Prep ${context.nextFullMoon.boss}`,
        copy: `${context.nextFullMoon.date} is the next Full Moon checkpoint.`,
        meta: 'Full Moon prep',
        action: { type: 'tartarus-floor', label: 'Open Floor Ops', floor: currentFloor },
        score: 38
      })
    );
  }

  const seen = new Set();
  return queue
    .sort((left, right) => right.score - left.score)
    .filter((item) => {
      const key = `${item.system}:${item.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function getPlannerModel() {
  const snapshot = getSnapshot();
  const currentFloor = snapshot.profile.currentFloor;
  const currentBlock = getCurrentBlock(currentFloor);
  const advisor = getSocialLinkAdvisor();
  const focusMode = getSocialLinkFocusMode();
  const advisorOptions = {
    date: snapshot.profile.gameDate,
    focusMode
  };
  const plannerModels = advisor ? advisor.getModels(snapshot, advisorOptions) : [];
  const decoratePick = (item) =>
    item
      ? {
          ...item,
          plannerReason: advisor.getRecommendationWhy(item, { focusMode }) || item.factors.slice(0, 2).join(', ')
        }
      : null;
  const dayPick = advisor ? decoratePick(advisor.getTopModelForDate(snapshot, { ...advisorOptions, timeSlot: 'day' })) : null;
  const nightPick = advisor ? decoratePick(advisor.getTopModelForDate(snapshot, { ...advisorOptions, timeSlot: 'evening' })) : null;
  const highPressureLinks = plannerModels
    .filter(
      (item) =>
        item.link &&
        !item.link.automatic &&
        item.rank < 10 &&
        (focusMode === 'completion' ? item.completion.pressure > 0 : item.weeklyPressure > 0)
    )
    .sort((left, right) => advisor.compareModels(left, right, { focusMode }))
    .slice(0, 3)
    .map((item) => ({
      ...item,
      plannerReason: advisor.getRecommendationWhy(item, { focusMode }) || item.factors.slice(0, 2).join(', ')
    }));
  const statBottlenecks = getStatBottlenecks(snapshot);
  const statFallback = statBottlenecks[0]
    ? {
        ...statBottlenecks[0],
        note: getStatGuide(statBottlenecks[0].stat)[0]?.note || 'A stat increase would unlock a stronger Social Link route.'
      }
    : null;
  const nextGatekeeper = currentBlock ? getNextGatekeeper(currentFloor, currentBlock.id) : null;
  const nextFullMoon = getNextFullMoon(snapshot);
  const urgentObjective = getUrgentObjective(snapshot);
  const urgentRequest = getUrgentRequest(snapshot);
  const nearestObjective = currentBlock ? getNearestObjective(snapshot, currentFloor, currentBlock.id) : null;
  const fusionOpportunity = getFusionOpportunity(snapshot, dayPick, nextFullMoon);
  const context = {
    currentBlock,
    dayPick,
    nightPick,
    highPressureLinks,
    statFallback,
    nextGatekeeper,
    nextFullMoon,
    urgentObjective,
    urgentRequest,
    nearestObjective,
    fusionOpportunity
  };
  const primaryAction = choosePrimaryAction(snapshot, {
    ...context,
    currentBlock: currentBlock || { name: 'Tartarus' }
  });

  return {
    snapshot,
    ...context,
    warnings: buildWarnings(snapshot, context),
    primaryAction,
    actionQueue: buildActionQueue(snapshot, context, primaryAction)
  };
}

function renderStateStrip(model) {
  const currentBlockLabel = model.currentBlock ? `${model.currentBlock.name} (${model.currentBlock.floors})` : 'Outside Tartarus';
  return `
    <div class="planner-state-pill"><span class="planner-state-label">Date</span><span class="planner-state-value">${escapeHtml(
      formatDate(model.snapshot.profile.gameDate)
    )}</span></div>
    <div class="planner-state-pill"><span class="planner-state-label">Level</span><span class="planner-state-value">Lv ${model.snapshot.profile.playerLevel}</span></div>
    <div class="planner-state-pill"><span class="planner-state-label">Current Floor</span><span class="planner-state-value">${model.snapshot.profile.currentFloor}F</span></div>
    <div class="planner-state-pill"><span class="planner-state-label">Current Block</span><span class="planner-state-value">${escapeHtml(
      currentBlockLabel
    )}</span></div>
  `;
}

function renderPrimaryAction(model) {
  const action = model.primaryAction;
  return `<h2>Best Next Action</h2>
    <div class="planner-primary-kicker">${escapeHtml(action.kicker)}</div>
    <div class="planner-primary-title">${escapeHtml(action.title)}</div>
    <div class="planner-copy">${escapeHtml(action.copy)}</div>
    <div class="planner-reason-list">${action.reasons
      .map((reason) => `<div class="planner-reason">${escapeHtml(reason)}</div>`)
      .join('')}</div>
    ${renderActionRow(action.action, action.completeId)}`;
}

function renderWarnings(model) {
  if (!model.warnings.length) {
    return '<h2>Warnings / At Risk</h2><div class="planner-empty">No strong warning signal is firing right now. Your run is in a stable state.</div>';
  }
  return `<h2>Warnings / At Risk</h2><div class="planner-warning-list">${model.warnings
    .map(
      (warning) =>
        `<div class="planner-warning${warning.tone === 'critical' ? ' planner-warning-critical' : ''}">
          <span>${escapeHtml(warning.text)}</span>
          ${warning.completeId ? renderCompleteButton(warning.completeId) : ''}
        </div>`
    )
    .join('')}</div>`;
}

function renderActionQueue(model) {
  if (!model.actionQueue.length) {
    return '<h2>Next Action Queue</h2><div class="planner-empty">No queued actions yet. Use the detailed Planner cards below for flexible routing.</div>';
  }
  return `<div class="planner-action-queue-head">
      <div>
        <h2>Next Action Queue</h2>
        <div class="planner-muted">A bundled route across Social Links, Requests, Tartarus, and Velvet Room.</div>
      </div>
      <span class="planner-action-queue-count">${model.actionQueue.length} live picks</span>
    </div>
    <div class="planner-action-queue">${model.actionQueue
      .map(
        (item, index) => `<article class="planner-action-item planner-action-item-${escapeHtml(item.tone)}">
          <div class="planner-action-rank">${index + 1}</div>
          <div class="planner-action-body">
            <div class="planner-action-meta"><span>${escapeHtml(item.system)}</span>${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ''}</div>
            <div class="planner-action-title">${escapeHtml(item.title)}</div>
            <div class="planner-action-copy">${escapeHtml(item.copy)}</div>
          </div>
          <div class="planner-action-cta">${renderActionRow(item.action, item.completeId)}</div>
        </article>`
      )
      .join('')}</div>`;
}

function renderSlotActionLegacy(label, item, fallback, blockedReason) {
  if (blockedReason) {
    return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">Blocked</span></div><div class="planner-slot-main">${escapeHtml(
      blockedReason
    )}</div></div>`;
  }
  if (item) {
    return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">${escapeHtml(
      item.arcana
    )}</span></div><div class="planner-slot-main">${escapeHtml(item.link.character)}</div><div class="planner-muted">${escapeHtml(
      item.reasons.join(' • ') || 'Best current pick.'
    )}</div><button class="planner-action-btn" data-nav="social-links">Open Social Links</button></div>`;
  }
  if (fallback) {
    return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">Fallback</span></div><div class="planner-slot-main">Raise ${escapeHtml(
      capitalize(fallback.stat)
    )}</div><div class="planner-muted">${escapeHtml(fallback.note)}</div><button class="planner-action-btn" data-nav="social-links">Open Social Links</button></div>`;
  }
  return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">Stable</span></div><div class="planner-slot-main">Flexible slot</div><div class="planner-muted">No strong pressure signal is active here right now.</div></div>`;
}

function renderDayNight(model) {
  const currentDate = model.snapshot.profile.gameDate;
  return `<h2>Today / Tonight</h2>
    <div class="planner-dual-actions">
      ${renderSlotAction('Today', model.dayPick, model.statFallback, getBlockedReason(currentDate.month, currentDate.day, 'day'))}
      ${renderSlotAction('Tonight', model.nightPick, model.statFallback, getBlockedReason(currentDate.month, currentDate.day, 'evening'))}
    </div>`;
}

function renderSlotAction(label, item, fallback, blockedReason) {
  if (blockedReason) {
    return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">Blocked</span></div><div class="planner-slot-main">${escapeHtml(
      blockedReason
    )}</div></div>`;
  }
  if (item) {
    return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">${escapeHtml(item.arcana)}</span></div><div class="planner-slot-main">${escapeHtml(item.link.character)}</div><div class="planner-muted">${escapeHtml(item.plannerReason || 'Best current pick.')}</div><button class="planner-action-btn" data-nav="social-links">Open Social Links</button></div>`;
  }
  if (fallback) {
    return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">Fallback</span></div><div class="planner-slot-main">Raise ${escapeHtml(
      capitalize(fallback.stat)
    )}</div><div class="planner-muted">${escapeHtml(fallback.note)}</div><button class="planner-action-btn" data-nav="social-links">Open Social Links</button></div>`;
  }
  return `<div class="planner-slot-card"><div class="planner-slot-top"><span class="planner-slot-name">${label}</span><span class="planner-slot-chip">Stable</span></div><div class="planner-slot-main">Flexible slot</div><div class="planner-muted">No strong pressure signal is active here right now.</div></div>`;
}

function renderTartarus(model) {
  const nextFullMoonDays =
    model.nextFullMoon && model.nextFullMoon.parsedDate
      ? daysBetween(model.snapshot.profile.gameDate, model.nextFullMoon.parsedDate)
      : null;
  const gatekeeperReadiness = model.nextGatekeeper
    ? getLevelReadiness(model.snapshot.profile.playerLevel, model.nextGatekeeper.lvl)
    : null;
  const fullMoonReadiness =
    model.nextFullMoon?.primaryStrategy?.recLevel
      ? getLevelReadiness(model.snapshot.profile.playerLevel, model.nextFullMoon.primaryStrategy.recLevel)
      : null;

  return `<h2>Next Tartarus Push</h2>
    <div class="planner-tartarus-list">
      <div class="planner-line"><strong>Block:</strong> ${escapeHtml(model.currentBlock ? model.currentBlock.name : 'Unknown')}</div>
      <div class="planner-line"><strong>Floor focus:</strong> ${model.nearestObjective ? `${model.nearestObjective.floor}F for ${escapeHtml(model.nearestObjective.title)}` : `Continue from ${model.snapshot.profile.currentFloor}F`}</div>
      <div class="planner-line"><strong>Next gatekeeper:</strong> ${model.nextGatekeeper ? `${escapeHtml(model.nextGatekeeper.name)} on ${model.nextGatekeeper.floor}F` : 'None left in this block'}</div>
      ${gatekeeperReadiness ? `<div class="planner-line"><strong>Gatekeeper readiness:</strong> ${escapeHtml(gatekeeperReadiness.text)}</div>` : ''}
      ${model.nextFullMoon ? `<div class="planner-line"><strong>Next Full Moon:</strong> ${escapeHtml(model.nextFullMoon.boss)} in ${nextFullMoonDays} day${nextFullMoonDays === 1 ? '' : 's'} (${escapeHtml(model.nextFullMoon.date)})</div>` : ''}
      ${fullMoonReadiness ? `<div class="planner-line"><strong>Full Moon readiness:</strong> ${escapeHtml(fullMoonReadiness.text)}</div>` : ''}
    </div>
    <button class="planner-action-btn" data-nav="tartarus-floor" data-floor="${model.snapshot.profile.currentFloor}">Open Floor Ops</button>`;
}

function renderFusion(model) {
  if (!model.fusionOpportunity) {
    return '<h2>Fusion Opportunity</h2><div class="planner-empty">No urgent fusion target stands out right now. Use Velvet Room when you want to improve coverage or chase a specific boss counter.</div>';
  }

  return `<h2>Fusion Opportunity</h2>
    <div class="planner-slot-main">${escapeHtml(model.fusionOpportunity.title)}</div>
    <div class="planner-copy">${escapeHtml(model.fusionOpportunity.copy)}</div>
    <div class="planner-fusion-list">${model.fusionOpportunity.lines
      .map((line) => `<div class="planner-line">${escapeHtml(line)}</div>`)
      .join('')}</div>
    ${model.fusionOpportunity.targetName ? `<button class="planner-action-btn" data-nav="velvet-target" data-target="${escapeHtml(
      model.fusionOpportunity.targetName
    )}">Open Fusion Planner</button>` : ''}`;
}

function renderActionButton(action) {
  if (!action) {
    return '';
  }
  if (action.type === 'tartarus-floor') {
    return `<button class="planner-action-btn" data-nav="tartarus-floor" data-floor="${action.floor}">${escapeHtml(action.label)}</button>`;
  }
  if (action.type === 'velvet-target') {
    return `<button class="planner-action-btn" data-nav="velvet-target" data-target="${escapeHtml(action.target)}">${escapeHtml(action.label)}</button>`;
  }
  return `<button class="planner-action-btn" data-nav="${escapeHtml(action.type)}">${escapeHtml(action.label)}</button>`;
}

function renderCompleteButton(completeId) {
  if (!completeId) {
    return '';
  }
  return `<button class="planner-action-btn planner-complete-btn" type="button" data-complete-id="${escapeHtml(completeId)}">Mark Done</button>`;
}

function renderActionRow(action, completeId) {
  const actionButton = renderActionButton(action);
  const completeButton = renderCompleteButton(completeId);
  if (!actionButton && !completeButton) {
    return '';
  }
  return `<div class="planner-action-row">${actionButton}${completeButton}</div>`;
}

function renderPlanner() {
  const model = getPlannerModel();

  plannerRoot.querySelector('#planner-state-strip').innerHTML = renderStateStrip(model);
  plannerRoot.querySelector('#planner-primary-action').innerHTML = renderPrimaryAction(model);
  plannerRoot.querySelector('#planner-warnings').innerHTML = renderWarnings(model);
  plannerRoot.querySelector('#planner-action-queue').innerHTML = renderActionQueue(model);
  plannerRoot.querySelector('#planner-day-night').innerHTML = renderDayNight(model);
  plannerRoot.querySelector('#planner-tartarus').innerHTML = renderTartarus(model);
  plannerRoot.querySelector('#planner-fusion').innerHTML = renderFusion(model);
}

function scheduleRenderPlanner() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  const run = () => {
    renderQueued = false;
    renderPlanner();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function onPlannerAction(event) {
  const completeButton = event.target.closest('[data-complete-id]');
  if (completeButton) {
    plannerStore.dispatch({
      type: 'OBJECTIVE_SET_COMPLETE',
      payload: {
        id: completeButton.dataset.completeId,
        complete: true
      }
    });
    return;
  }

  const button = event.target.closest('[data-nav]');
  if (!button || !window.p3rApp) {
    return;
  }
  const nav = button.dataset.nav;
  if (nav === 'social-links') {
    window.p3rApp.openSocialLinks();
    return;
  }
  if (nav === 'requests') {
    window.p3rApp.openRequests();
    return;
  }
  if (nav === 'tartarus-floor') {
    window.p3rApp.openTartarusFloor(Number(button.dataset.floor));
    return;
  }
  if (nav === 'velvet-target') {
    window.p3rApp.openFusionTarget(button.dataset.target || '');
  }
}

function initPlanner({ root, store }) {
  if (initialized) {
    return;
  }
  plannerRoot = root;
  plannerStore = store;
  initialized = true;

  if (typeof window.mountRunStatePanel === 'function') {
    window.mountRunStatePanel({
      root: plannerRoot,
      store: plannerStore,
      selector: '#planner-run-state',
      title: 'Run State',
      subtitle: 'Shared inputs for planning, Tartarus readiness, and Social Link routing.',
      fields: ['date', 'level', 'floor', 'academics', 'charm', 'courage'],
      note: 'These controls update the same save-backed state used across every section.'
    });
  }

  plannerRoot.addEventListener('click', onPlannerAction);
  plannerStore.subscribe(scheduleRenderPlanner);
  if (window.p3rApp?.subscribeToSocialLinkFocusMode) {
    window.p3rApp.subscribeToSocialLinkFocusMode(scheduleRenderPlanner);
  }
  renderPlanner();
}

window.initPlanner = initPlanner;
})();
