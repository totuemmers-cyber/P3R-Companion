import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const VALID_BLOCKS = new Set(['thebel', 'arqa', 'yabbashah', 'tziah', 'harabah', 'adamah']);
const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs']);

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function rel(path) {
  return relative(repoRoot, path).replace(/\\/g, '/');
}

function readRepoFile(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function createContext(extra = {}) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    ...extra
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  return context;
}

function runScript(context, path) {
  vm.runInContext(readRepoFile(path), context, { filename: path });
}

function loadDataContext() {
  const context = createContext();
  [
    'data/enemies.js',
    'data/personas.js',
    'data/social-links.js',
    'data/social-links-verified.js',
    'data/linked-episodes.js',
    'data/tartarus-extra.js',
    'data/tartarus-chest-loot.js',
    'data/personas-extra.js',
    'data/fusion-unlocks.js',
    'data/social-links-extra.js',
    'data/requests-extra.js',
    'data/elizabeth-requests.js'
  ].forEach((path) => runScript(context, path));
  return context;
}

function getGlobal(context, name) {
  return vm.runInContext(name, context);
}

function parseDateLabel(value) {
  if (value == null) {
    return null;
  }
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const maxDay = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  if (!maxDay || day < 1 || day > maxDay) {
    return null;
  }
  return { month, day };
}

function compareGameDates(left, right) {
  const leftMonth = left.month >= 4 ? left.month : left.month + 12;
  const rightMonth = right.month >= 4 ? right.month : right.month + 12;
  return leftMonth * 100 + left.day - (rightMonth * 100 + right.day);
}

function daysBetweenGameDates(left, right) {
  const leftYear = left.month >= 4 ? 2009 : 2010;
  const rightYear = right.month >= 4 ? 2009 : 2010;
  const leftDate = new Date(leftYear, left.month - 1, left.day);
  const rightDate = new Date(rightYear, right.month - 1, right.day);
  return Math.round((rightDate - leftDate) / 86400000);
}

function isDeadlineStaleForDate(item, completed, currentDate) {
  if (completed[item.id]) {
    return false;
  }
  const deadlineDate = parseDateLabel(item.deadline);
  return Boolean(deadlineDate && daysBetweenGameDates(currentDate, deadlineDate) < 0);
}

function getDeadlineTrackingState(item, completed, currentDate) {
  if (completed[item.id]) {
    return 'complete';
  }
  if (isDeadlineStaleForDate(item, completed, currentDate)) {
    return 'stale';
  }
  const availableDate = parseDateLabel(item.available);
  if (availableDate && compareGameDates(currentDate, availableDate) < 0) {
    return 'upcoming';
  }
  return 'active';
}

function assertUnique(items, label, getKey) {
  const seen = new Set();
  items.forEach((item) => {
    const key = getKey(item);
    assert(Boolean(key), `${label} has an empty key`);
    if (!key) {
      return;
    }
    assert(!seen.has(key), `${label} has duplicate key: ${key}`);
    seen.add(key);
  });
}

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') {
      continue;
    }
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walkFiles(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

function validateEncoding() {
  const suspiciousPattern = new RegExp('[\\u00c3\\u00c2\\ufffd]', 'u');
  walkFiles(repoRoot)
    .filter((path) => SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf('.'))))
    .forEach((path) => {
      const text = readFileSync(path, 'utf8');
      assert(!suspiciousPattern.test(text), `${rel(path)} contains likely mojibake/replacement characters`);
    });
}

function validatePersonas(context) {
  const PERSONAS = getGlobal(context, 'PERSONAS');
  const SPECIAL_RECIPES = getGlobal(context, 'SPECIAL_RECIPES');
  const ARCANA_LIST = getGlobal(context, 'ARCANA_LIST');
  const INHERIT_MAP = getGlobal(context, 'INHERIT_MAP');
  const SKILLS = getGlobal(context, 'SKILLS');
  const ARCANA_CHART = getGlobal(context, 'ARCANA_CHART');
  const arcanaSet = new Set(ARCANA_LIST);

  assert(Object.keys(PERSONAS).length > 100, 'PERSONAS should contain the extracted compendium');
  assertUnique(Object.keys(PERSONAS), 'PERSONAS', (name) => name);

  for (const [name, persona] of Object.entries(PERSONAS)) {
    assert(Number.isInteger(persona.lvl) && persona.lvl >= 1 && persona.lvl <= 99, `${name} has invalid level`);
    assert(arcanaSet.has(persona.race), `${name} has unknown arcana: ${persona.race}`);
    assert(Array.isArray(persona.stats) && persona.stats.length === 5, `${name} must have five stats`);
    assert(persona.stats.every((stat) => Number.isInteger(stat) && stat >= 0), `${name} has invalid stats`);
    assert(typeof persona.resists === 'string' && persona.resists.length === 10, `${name} has invalid resist string`);
    assert(Boolean(INHERIT_MAP[persona.inherits]), `${name} has unknown inheritance profile: ${persona.inherits}`);
    assert(persona.skills && typeof persona.skills === 'object', `${name} must have skills`);
    for (const [skill, level] of Object.entries(persona.skills || {})) {
      assert(Boolean(SKILLS[skill]), `${name} references unknown skill: ${skill}`);
      assert(Number.isInteger(level) && level >= -1 && level <= 99, `${name} has invalid skill level for ${skill}`);
    }
  }

  for (const [target, ingredients] of Object.entries(SPECIAL_RECIPES)) {
    assert(Boolean(PERSONAS[target]), `Special recipe target is missing from PERSONAS: ${target}`);
    assert(Array.isArray(ingredients) && ingredients.length >= 2, `${target} special recipe needs at least two ingredients`);
    ingredients.forEach((ingredient) => {
      assert(Boolean(PERSONAS[ingredient]), `${target} special recipe references missing ingredient: ${ingredient}`);
    });
  }

  for (const [arcana, chart] of Object.entries(ARCANA_CHART)) {
    assert(arcanaSet.has(arcana), `ARCANA_CHART has unknown source arcana: ${arcana}`);
    for (const [otherArcana, resultArcana] of Object.entries(chart)) {
      assert(arcanaSet.has(otherArcana), `ARCANA_CHART ${arcana} has unknown partner arcana: ${otherArcana}`);
      assert(arcanaSet.has(resultArcana), `ARCANA_CHART ${arcana}/${otherArcana} has unknown result arcana: ${resultArcana}`);
    }
  }

  console.log(`Validated ${Object.keys(PERSONAS).length} personas and ${Object.keys(SPECIAL_RECIPES).length} special recipes.`);
}

function validateEnemies(context) {
  const ENEMY_RAW = getGlobal(context, 'ENEMY_RAW');
  assert(Object.keys(ENEMY_RAW).length > 100, 'ENEMY_RAW should contain the extracted enemy list');
  assertUnique(Object.keys(ENEMY_RAW), 'ENEMY_RAW', (name) => name);

  for (const [name, enemy] of Object.entries(ENEMY_RAW)) {
    assert(typeof enemy.area === 'string' && enemy.area.length > 0, `${name} has no area`);
    assert(Number.isInteger(enemy.lvl) && enemy.lvl >= 1 && enemy.lvl <= 99, `${name} has invalid level`);
    assert(Number.isInteger(enemy.exp) && enemy.exp >= 0, `${name} has invalid EXP`);
    assert(typeof enemy.race === 'string' && enemy.race.length > 0, `${name} has no race`);
    assert(typeof enemy.resists === 'string' && enemy.resists.length === 10, `${name} has invalid resist string`);
    if (enemy.ailments !== undefined) {
      assert(typeof enemy.ailments === 'string' && /^[nsv-]{6}$/.test(enemy.ailments), `${name} has invalid ailment string`);
    }
    assert(Array.isArray(enemy.skills), `${name} must expose skills as an array`);
    assert(Array.isArray(enemy.stats) && enemy.stats.length === 7, `${name} must have seven combat stats`);
    assert(enemy.stats.every((stat) => Number.isInteger(stat) && stat >= 0), `${name} has invalid combat stats`);
    for (const [drop, chance] of Object.entries(enemy.dodds || {})) {
      assert(drop.length > 0, `${name} has an empty drop name`);
      assert(Number.isFinite(chance) && chance >= 0 && chance <= 100, `${name} has invalid drop chance for ${drop}`);
    }
  }

  console.log(`Validated ${Object.keys(ENEMY_RAW).length} enemies.`);
}

function validateRequests(context) {
  const PERSONAS = getGlobal(context, 'PERSONAS');
  const SKILLS = getGlobal(context, 'SKILLS');
  const requests = context.ELIZABETH_REQUESTS;
  assert(Array.isArray(requests) && requests.length >= 100, 'ELIZABETH_REQUESTS should contain the request list');
  assertUnique(requests, 'ELIZABETH_REQUESTS ids', (request) => request.id);
  assertUnique(requests, 'ELIZABETH_REQUESTS numbers', (request) => request.number);

  requests.forEach((request) => {
    assert(Number.isInteger(request.number) && request.number > 0, `${request.id} has invalid number`);
    assert(typeof request.title === 'string' && request.title.length > 0, `${request.id} has no title`);
    assert(typeof request.reward === 'string' && request.reward.length > 0, `${request.id} has no reward`);
    assert(typeof request.solution === 'string' && request.solution.length > 0, `${request.id} has no solution`);
    assert(Boolean(request.categoryLabel), `${request.id} has no category label`);
    assert(Boolean(request.systemLabel), `${request.id} has no system label`);
    assert(request.available === null || Boolean(parseDateLabel(request.available)), `${request.id} has invalid available date: ${request.available}`);
    assert(request.deadline === null || Boolean(parseDateLabel(request.deadline)), `${request.id} has invalid deadline date: ${request.deadline}`);
    if (request.floor !== null) {
      assert(Number.isInteger(request.floor) && request.floor >= 1 && request.floor <= 264, `${request.id} has invalid floor: ${request.floor}`);
    }
    if (request.block !== null) {
      assert(VALID_BLOCKS.has(request.block), `${request.id} has invalid block: ${request.block}`);
    }
    if (request.targetPersona !== null) {
      assert(Boolean(PERSONAS[request.targetPersona]), `${request.id} targets missing persona: ${request.targetPersona}`);
    }
    if (request.targetSkill !== null) {
      assert(Boolean(SKILLS[request.targetSkill]), `${request.id} targets missing skill: ${request.targetSkill}`);
    }
  });

  const byNumber = Object.fromEntries(requests.map((request) => [request.number, request]));
  assert(byNumber[7]?.prerequisite?.includes('Quest 2'), 'Request #7 should require the first Old Document request');
  assert(byNumber[9]?.prerequisite?.includes('Quest 1'), 'Request #9 should unlock after Request #1');
  assert(!byNumber[9]?.prerequisite?.includes('Quest 9'), 'Request #9 should not require itself');
  assert(byNumber[11]?.prerequisite?.includes('Quest 9'), 'Request #11 should unlock after Request #9');
  assert(
    /look away from the burgers.+eat without stopping.+imagine something sour/i.test(byNumber[11]?.solution || ''),
    'Request #11 should include the full Big Eater Challenge answer sequence'
  );

  console.log(`Validated ${requests.length} Elizabeth requests.`);
}

function validateTartarusObjectives(context) {
  const objectives = getGlobal(context, 'TARTARUS_OBJECTIVES');
  const blocks = getGlobal(context, 'BLOCKS');
  assert(Array.isArray(objectives) && objectives.length > 20, 'TARTARUS_OBJECTIVES should contain high-value objectives');
  assertUnique(objectives, 'TARTARUS_OBJECTIVES', (objective) => objective.id);

  objectives.forEach((objective) => {
    assert(typeof objective.title === 'string' && objective.title.length > 0, `${objective.id} has no title`);
    assert(typeof objective.type === 'string' && objective.type.length > 0, `${objective.id} has no type`);
    assert(VALID_BLOCKS.has(objective.block), `${objective.id} has invalid block: ${objective.block}`);
    assert(Number.isInteger(objective.floor) && objective.floor >= 1 && objective.floor <= 264, `${objective.id} has invalid floor`);
    const block = blocks.find((candidate) => candidate.id === objective.block);
    assert(Boolean(block), `${objective.id} references missing block data: ${objective.block}`);
    if (block) {
      assert(objective.floor >= block.fMin && objective.floor <= block.fMax, `${objective.id} floor ${objective.floor} is outside ${objective.block}`);
    }
    assert(Boolean(parseDateLabel(objective.available)), `${objective.id} has invalid available date: ${objective.available}`);
    assert(objective.deadline === null || Boolean(parseDateLabel(objective.deadline)), `${objective.id} has invalid deadline: ${objective.deadline}`);
    assert(typeof objective.reward === 'string' && objective.reward.length > 0, `${objective.id} has no reward`);
    assert(typeof objective.note === 'string' && objective.note.length > 0, `${objective.id} has no note`);
  });

  console.log(`Validated ${objectives.length} Tartarus objectives.`);
}

function validateTartarusChestLoot(context) {
  const chestLoot = getGlobal(context, 'TARTARUS_CHEST_LOOT');
  const validImportance = new Set(['key', 'unique', 'rare', 'valuable']);
  const validChestTypes = new Set(['fixed', 'locked', 'monad-passage', 'boss-floor-locked']);

  assert(Array.isArray(chestLoot) && chestLoot.length >= 25, 'TARTARUS_CHEST_LOOT should contain fixed and rare chest rewards');
  assertUnique(chestLoot, 'TARTARUS_CHEST_LOOT', (entry) => entry.id);

  chestLoot.forEach((entry) => {
    assert(typeof entry.id === 'string' && entry.id.length > 0, 'Chest loot entry has no id');
    assert(Number.isInteger(entry.floor) && entry.floor >= 2 && entry.floor <= 264, `${entry.id} has invalid floor: ${entry.floor}`);
    assert(VALID_BLOCKS.has(entry.block), `${entry.id} has invalid block: ${entry.block}`);
    const block = getGlobal(context, 'BLOCKS').find((candidate) => candidate.id === entry.block);
    assert(Boolean(block), `${entry.id} references missing block data: ${entry.block}`);
    if (block) {
      assert(entry.floor >= block.fMin && entry.floor <= block.fMax, `${entry.id} floor ${entry.floor} is outside ${entry.block}`);
    }
    assert(typeof entry.item === 'string' && entry.item.length > 0, `${entry.id} has no item`);
    assert(typeof entry.category === 'string' && entry.category.length > 0, `${entry.id} has no category`);
    assert(validChestTypes.has(entry.chestType), `${entry.id} has invalid chestType: ${entry.chestType}`);
    assert(validImportance.has(entry.importance), `${entry.id} has invalid importance: ${entry.importance}`);
    assert(entry.fragmentCost === null || Number.isInteger(entry.fragmentCost), `${entry.id} has invalid fragmentCost`);
    assert(typeof entry.sourceNote === 'string' && entry.sourceNote.length > 0, `${entry.id} has no sourceNote`);
  });

  const byId = Object.fromEntries(chestLoot.map((entry) => [entry.id, entry]));
  assert(byId['old-document-01']?.floor === 22 && byId['old-document-01']?.importance === 'key', 'Old Document 01 should be a key chest alert on 22F');
  assert(byId.juzumaru?.floor === 36 && byId.juzumaru?.importance === 'rare', 'Juzumaru should be a rare chest alert on 36F');
  assert(byId['onimaru-kunitsuna']?.floor === 54 && byId['onimaru-kunitsuna']?.importance === 'rare', 'Onimaru Kunitsuna should be a rare chest alert on 54F');
  assert(byId['memoir-02']?.floor === 91 && byId['memoir-02']?.importance === 'unique', 'Memoir 02 should be a unique chest alert on 91F');
  assert(byId['book-of-samech']?.floor === 91 && byId['book-of-samech']?.importance === 'unique', 'Book of Samech should be a unique chest alert on 91F');
  assert(byId.excalibur?.floor === 247 && byId.excalibur?.importance === 'rare', 'Excalibur should be a rare chest alert on 247F');

  console.log(`Validated ${chestLoot.length} Tartarus chest loot alerts.`);
}

function validateLinkedEpisodes(context) {
  const episodes = getGlobal(context, 'LINKED_EPISODES');
  const FUSION_UNLOCKS = getGlobal(context, 'FUSION_UNLOCKS');
  assert(Array.isArray(episodes) && episodes.length >= 30, 'LINKED_EPISODES should contain base-game linked episode records');
  assertUnique(episodes, 'LINKED_EPISODES', (episode) => episode.id);

  const ids = new Set(episodes.map((episode) => episode.id));
  const validSlots = new Set(['day', 'evening', 'auto']);
  const validEventTypes = new Set(['manual', 'reminder', 'auto']);
  episodes.forEach((episode) => {
    assert(typeof episode.character === 'string' && episode.character.length > 0, `${episode.id} has no character`);
    assert(validSlots.has(episode.timeSlot), `${episode.id} has invalid timeSlot: ${episode.timeSlot}`);
    if (episode.eventType) {
      assert(validEventTypes.has(episode.eventType), `${episode.id} has invalid eventType: ${episode.eventType}`);
    }
    assert(Boolean(episode.startDate) && Boolean(episode.deadline), `${episode.id} must have startDate and deadline`);
    assert(compareGameDates(episode.startDate, episode.deadline) <= 0, `${episode.id} startDate is after deadline`);
    assert(typeof episode.location === 'string' && episode.location.length > 0, `${episode.id} has no location`);
    assert(typeof episode.reward === 'string', `${episode.id} has invalid reward`);
    assert(typeof episode.optional === 'boolean', `${episode.id} optional must be boolean`);
    assert(typeof episode.takesTime === 'boolean', `${episode.id} takesTime must be boolean`);
    assert(typeof episode.storyCritical === 'boolean', `${episode.id} storyCritical must be boolean`);
    if (episode.requiredPreviousId) {
      assert(ids.has(episode.requiredPreviousId), `${episode.id} references missing previous episode: ${episode.requiredPreviousId}`);
    }
    (episode.availableDays || []).forEach((day) => {
      assert(Number.isInteger(day) && day >= 0 && day <= 6, `${episode.id} has invalid available day: ${day}`);
    });
    (episode.availableDates || []).forEach((date) => {
      assert(Boolean(date?.month && date?.day), `${episode.id} has invalid available date`);
    });
  });

  const byId = Object.fromEntries(episodes.map((episode) => [episode.id, episode]));
  const junpei3 = byId['junpei-03'];
  assert(junpei3?.startDate.month === 11 && junpei3.startDate.day === 7, 'junpei-03 should open on 11/7');
  assert(junpei3?.deadline.month === 11 && junpei3.deadline.day === 13, 'junpei-03 should run through 11/13');
  assert(junpei3?.timeSlot === 'day' && junpei3?.storyCritical, 'junpei-03 should be a storyCritical daytime episode');
  assert(/Classroom/i.test(junpei3?.location || ''), 'junpei-03 should point to the Classroom');

  const flowers = byId['junpei-chidori-flowers'];
  assert(flowers?.startDate.month === 11 && flowers.startDate.day === 8, 'Junpei flowers follow-up should open on 11/8');
  assert(flowers?.deadline.month === 11 && flowers.deadline.day === 20, 'Junpei flowers follow-up should run through 11/20');
  assert(flowers?.timeSlot === 'evening' && flowers?.storyCritical && flowers?.optional, 'Junpei flowers follow-up should be optional evening storyCritical reminder');
  assert(flowers?.takesTime === false, 'Junpei flowers follow-up should not consume time');

  const ryoji1 = byId['ryoji-01'];
  assert(ryoji1?.eventType === 'auto' && ryoji1?.takesTime === false, 'ryoji-01 should be an automatic story-linked scene, not a manual activity');
  assert(ryoji1?.timeSlot === 'day' && ryoji1?.startDate.month === 11 && ryoji1.startDate.day === 9, 'ryoji-01 should remain a Nov 9 daytime story marker');
  assert(/No manual Social Link action/i.test(ryoji1?.notes || ''), 'ryoji-01 notes should clarify there is no manual Social Link action');
  const ryoji2 = byId['ryoji-02'];
  assert(ryoji2?.eventType === 'manual' && ryoji2?.takesTime === true, 'ryoji-02 should remain the manual classroom Linked Episode');
  const ryoji5 = byId['ryoji-05'];
  assert(ryoji5?.eventType === 'auto' && ryoji5?.takesTime === false, 'ryoji-05 should be an automatic ending-gated reward event');

  const linkedGates = Object.entries(FUSION_UNLOCKS.gatedPersonas || {})
    .filter(([, gate]) => gate.type === 'linkedEpisode');
  linkedGates.forEach(([persona, gate]) => {
    assert(ids.has(gate.id), `${persona} linked episode gate references missing id: ${gate.id}`);
    const episode = byId[gate.id];
    assert(episode?.personaUnlock === persona, `${persona} gate should match final linked episode personaUnlock`);
    assert(typeof gate.legacyKey === 'string' && gate.legacyKey.length > 0, `${persona} linked episode gate needs a legacyKey fallback`);
  });
  ['Surt', 'Horus', 'Byakko', 'Michael', 'Hell Biker', 'Saturnus'].forEach((persona) => {
    assert(linkedGates.some(([name]) => name === persona), `${persona} should be gated by final linked episode completion`);
  });

  console.log(`Validated ${episodes.length} Linked Episodes.`);
}

function validateLinkedEpisodeAdvisor() {
  const context = createContext();
  [
    'data/personas.js',
    'data/social-links.js',
    'data/social-links-verified.js',
    'data/linked-episodes.js',
    'js/social-link-rules.js',
    'js/linked-episode-advisor.js',
    'js/social-link-advisor.js'
  ].forEach((path) => runScript(context, path));
  const SOCIAL_LINKS = getGlobal(context, 'SOCIAL_LINKS');
  const ARCANA_LIST = getGlobal(context, 'ARCANA_LIST');
  const LINKED_EPISODES = getGlobal(context, 'LINKED_EPISODES');
  const advisor = context.socialLinkAdvisor;
  const linkedAdvisor = context.linkedEpisodeAdvisor;
  const makeSnapshot = ({ month, day, completed = {}, skipped = {}, ranks = {} }) => ({
    roster: ['Nekomata', 'Apsaras', 'Angel'],
    profile: {
      gameDate: { month, day },
      playerLevel: 70,
      currentFloor: 164,
      stats: { academics: 6, charm: 6, courage: 6 }
    },
    socialLinks: {
      ranks: Object.fromEntries(ARCANA_LIST.map((arcana) => [arcana, ranks[arcana] || 0]))
    },
    objectives: {},
    linkedEpisodes: { completed, skipped },
    fusionSettings: { dlcEnabled: true, manualUnlocks: {} }
  });

  const beforeChidori = makeSnapshot({
    month: 11,
    day: 7,
    completed: { 'junpei-01': true, 'junpei-02': true }
  });
  const nov7DayPick = advisor.getTopActivityModelForDate(beforeChidori, {
    date: beforeChidori.profile.gameDate,
    timeSlot: 'day',
    focusMode: 'balanced'
  });
  assert(nov7DayPick?.id === 'junpei-03', `Expected Junpei episode 3 to lead daytime recommendations on 11/7, got ${nov7DayPick?.id || nov7DayPick?.arcana}`);
  assert(/Chidori route/.test(advisor.getActivityRecommendationWhy(nov7DayPick, { focusMode: 'balanced' })), 'Junpei 11/7 copy should mention the Chidori route');

  const afterJunpei3 = makeSnapshot({
    month: 11,
    day: 8,
    completed: { 'junpei-01': true, 'junpei-02': true, 'junpei-03': true }
  });
  const flowerPick = advisor.getTopActivityModelForDate(afterJunpei3, {
    date: afterJunpei3.profile.gameDate,
    timeSlot: 'evening',
    focusMode: 'balanced'
  });
  assert(flowerPick?.id === 'junpei-chidori-flowers', `Expected Junpei flower follow-up to lead evening reminders after episode 3, got ${flowerPick?.id || flowerPick?.arcana}`);
  assert(/White Flowers.*January events/.test(advisor.getActivityRecommendationWhy(flowerPick, { focusMode: 'balanced' })), 'Flower follow-up copy should mention White Flowers and January events');

  const ryojiNov9 = makeSnapshot({
    month: 11,
    day: 9
  });
  const ryojiNov9Model = linkedAdvisor.getModels(ryojiNov9, {
    date: ryojiNov9.profile.gameDate,
    timeSlot: 'day'
  }).find((model) => model.id === 'ryoji-01');
  assert(ryojiNov9Model?.episodeKind === 'auto', 'ryoji-01 model should be marked as an automatic story scene');
  assert(ryojiNov9Model?.availability.status === 'auto', `ryoji-01 should be an automatic Nov 9 story marker, got ${ryojiNov9Model?.availability.status}`);
  assert(!ryojiNov9Model?.actionableToday && !ryojiNov9Model?.availableToday, 'ryoji-01 should not be actionable or available as a manual time pick');
  assert(/No manual Social Link action/.test(ryojiNov9Model?.nextStep || ''), 'ryoji-01 next step should clarify no manual Social Link action is available');
  assert(!ryojiNov9Model.tags.some((tag) => /Urgent|Deadline soon/i.test(tag)), 'ryoji-01 should not carry urgent/deadline action tags');
  const ryojiNov9Actionable = linkedAdvisor.getActionableModels(ryojiNov9, {
    date: ryojiNov9.profile.gameDate,
    timeSlot: 'day'
  });
  assert(!ryojiNov9Actionable.some((model) => model.id === 'ryoji-01'), 'ryoji-01 should not be returned by linked getActionableModels');
  const nov9DayPick = advisor.getTopActivityModelForDate(ryojiNov9, {
    date: ryojiNov9.profile.gameDate,
    timeSlot: 'day',
    focusMode: 'balanced'
  });
  assert(nov9DayPick?.id !== 'ryoji-01', 'ryoji-01 should not win Nov 9 daytime recommendations');

  const ryojiNov12 = makeSnapshot({
    month: 11,
    day: 12
  });
  const ryojiNov12Actionable = linkedAdvisor.getActionableModels(ryojiNov12, {
    date: ryojiNov12.profile.gameDate,
    timeSlot: 'day'
  });
  assert(ryojiNov12Actionable.some((model) => model.id === 'ryoji-02'), 'Ryoji Nov 12 classroom Linked Episode should remain actionable after the automatic Nov 9 scene');

  const missedJunpei3 = makeSnapshot({
    month: 12,
    day: 19,
    completed: { 'junpei-01': true, 'junpei-02': true }
  });
  const junpei4 = linkedAdvisor.getModels(missedJunpei3, { date: missedJunpei3.profile.gameDate })
    .find((model) => model.id === 'junpei-04');
  assert(junpei4?.availability.status === 'blocked', 'Junpei episode 4 should be blocked if episode 3 expired incomplete');

  const koromaruWindow = makeSnapshot({
    month: 9,
    day: 9,
    completed: { 'koromaru-01': true }
  });
  const koromaruModels = linkedAdvisor.getActionableModels(koromaruWindow, {
    date: koromaruWindow.profile.gameDate,
    timeSlot: 'day'
  });
  assert(koromaruModels.some((model) => model.id === 'koromaru-02'), 'Koromaru long-window episode should appear when available');
  const sep9DayPick = advisor.getTopActivityModelForDate(koromaruWindow, {
    date: koromaruWindow.profile.gameDate,
    timeSlot: 'day',
    focusMode: 'balanced'
  });
  assert(sep9DayPick?.id !== 'koromaru-02', `Koromaru long-window episode should not crowd out stronger daytime activity, got ${sep9DayPick?.id || sep9DayPick?.arcana}`);

  const unlocks = [
    ['junpei-05', 'Surt'],
    ['akihiko-05', 'Horus'],
    ['koromaru-05', 'Byakko'],
    ['ken-05', 'Michael'],
    ['shinjiro-05', 'Hell Biker'],
    ['ryoji-05', 'Saturnus']
  ];
  unlocks.forEach(([id, persona]) => {
    const episode = LINKED_EPISODES.find((entry) => entry.id === id);
    assert(episode?.personaUnlock === persona, `${id} should unlock ${persona}`);
  });
  assert(Object.keys(SOCIAL_LINKS).length > 0, 'Social link fixture should remain loaded for combined advisor tests');

  console.log('Validated Linked Episode advisor behavior.');
}

function validateStaleDeadlineFiltering(context) {
  const objectives = getGlobal(context, 'TARTARUS_OBJECTIVES');
  const requests = context.ELIZABETH_REQUESTS;
  const currentDate = { month: 11, day: 4 };
  const completed = {};
  const urgentObjectiveCandidates = objectives
    .map((objective) => {
      if (completed[objective.id] || isDeadlineStaleForDate(objective, completed, currentDate)) {
        return null;
      }
      const availableDate = parseDateLabel(objective.available);
      if (availableDate && compareGameDates(currentDate, availableDate) < 0) {
        return null;
      }
      const deadlineDate = parseDateLabel(objective.deadline);
      if (!deadlineDate) {
        return null;
      }
      const daysLeft = daysBetweenGameDates(currentDate, deadlineDate);
      if (daysLeft <= 10) {
        return { ...objective, daysLeft };
      }
      return null;
    })
    .filter(Boolean);
  const urgentRequestCandidates = requests
    .map((request) => {
      if (completed[request.id] || isDeadlineStaleForDate(request, completed, currentDate)) {
        return null;
      }
      const availableDate = parseDateLabel(request.available);
      if (availableDate && compareGameDates(currentDate, availableDate) < 0) {
        const opensIn = daysBetweenGameDates(currentDate, availableDate);
        return opensIn <= 3 ? { ...request, opensIn } : null;
      }
      const deadlineDate = parseDateLabel(request.deadline);
      if (!deadlineDate) {
        return null;
      }
      const daysLeft = daysBetweenGameDates(currentDate, deadlineDate);
      return daysLeft <= 7 ? { ...request, daysLeft } : null;
    })
    .filter(Boolean);

  const ayako = objectives.find((objective) => objective.id === 'missing-ayako-yoshimoto');
  assert(Boolean(ayako), 'Expected Ayako Yoshimoto rescue objective fixture');
  assert(isDeadlineStaleForDate(ayako, completed, currentDate), 'Ayako Yoshimoto should be stale on 11/4 when incomplete');
  assert(!urgentObjectiveCandidates.some((objective) => objective.id === ayako.id), 'Stale Ayako objective should not qualify as urgent on 11/4');
  ['7/6', '8/5', '9/4', '10/3'].forEach((deadline) => {
    assert(
      !urgentObjectiveCandidates.some((objective) => objective.deadline === deadline),
      `Expired ${deadline} rescue objectives should not qualify as urgent on 11/4`
    );
  });

  assert(
    urgentRequestCandidates.some((request) => request.deadline === '11/30'),
    'Future November Elizabeth deadlines should still qualify after stale requests are filtered'
  );
  assert(
    requests.some((request) => request.deadline === '12/25' && !isDeadlineStaleForDate(request, completed, currentDate)),
    'Future December Elizabeth deadlines should not be stale on 11/4'
  );

  const completedAyako = { [ayako.id]: true };
  assert(!isDeadlineStaleForDate(ayako, completedAyako, currentDate), 'Completed expired objectives should not be stale');
  assert(getDeadlineTrackingState(ayako, completedAyako, currentDate) === 'complete', 'Completed expired objectives should stay completed');

  console.log('Validated stale deadline filtering rules.');
}

function validateFusionRecommendationLevelGates(context) {
  const PERSONAS = getGlobal(context, 'PERSONAS');
  const SPECIAL_RECIPES = getGlobal(context, 'SPECIAL_RECIPES');
  const BOSS_STRATS = getGlobal(context, 'BOSS_STRATS');
  const extractPersonaName = (value) => String(value || '').split(' (')[0].trim();
  const canRecommend = (name, level, roster = new Set()) =>
    Boolean(name && PERSONAS[name] && PERSONAS[name].lvl <= level && !roster.has(name));
  const pickBossPersona = (personas, level, roster = new Set()) =>
    (personas || []).map(extractPersonaName).find((name) => canRecommend(name, level, roster)) || null;
  const pickArcanaPersona = (arcana, level, roster = new Set()) =>
    Object.entries(PERSONAS)
      .filter(([name, persona]) => persona.race === arcana && !SPECIAL_RECIPES[name])
      .map(([name, persona]) => ({ name, lvl: persona.lvl }))
      .sort((left, right) => left.lvl - right.lvl || left.name.localeCompare(right.name))
      .find((entry) => entry.lvl <= level && !roster.has(entry.name)) || null;

  assert(PERSONAS.Loki?.lvl === 69, 'Expected Loki to remain a Lv 69 Persona fixture');
  const hangedManPersonas = BOSS_STRATS['Hanged Man A']?.personas || [];
  assert(hangedManPersonas.map(extractPersonaName).includes('Loki'), 'Expected Hanged Man prep fixture to include Loki');
  assert(
    pickBossPersona(hangedManPersonas, 64) !== 'Loki',
    'Planner boss prep should not recommend Loki at player level 64'
  );
  assert(
    pickBossPersona(hangedManPersonas, 64) === 'Dominion',
    'Planner boss prep should fall through to Dominion at player level 64'
  );
  assert(
    canRecommend('Loki', 69),
    'Loki should only become recommendable at player level 69 or higher'
  );
  assert(hangedManPersonas.indexOf('Dominion (Wind / Light)') < hangedManPersonas.findIndex((persona) => extractPersonaName(persona) === 'Loki'), 'Hanged Man prep should list attainable coverage before Loki');
  assert(
    pickBossPersona(['Loki (Multi-element)'], 64) === null,
    'Planner boss prep should emit no impossible fusion recommendation when every target is level-locked'
  );
  Object.values(PERSONAS).forEach((persona) => {
    const pick = pickArcanaPersona(persona.race, 64);
    assert(!pick || pick.lvl <= 64, `Planner arcana suggestion for ${persona.race} exceeds player level 64`);
  });

  console.log('Validated fusion recommendation level gates.');
}

function validateRosterOpportunityLevelGates(context) {
  const PERSONAS = getGlobal(context, 'PERSONAS');
  const SPECIAL_RECIPES = getGlobal(context, 'SPECIAL_RECIPES');
  const ARCANA_CHART = getGlobal(context, 'ARCANA_CHART');
  const ARCANA_LIST = getGlobal(context, 'ARCANA_LIST');
  const SOCIAL_LINKS = getGlobal(context, 'SOCIAL_LINKS');
  const FUSION_UNLOCKS = getGlobal(context, 'FUSION_UNLOCKS');
  const source = readRepoFile('js/velvet.js');
  const specialPersonas = new Set(Object.keys(SPECIAL_RECIPES));
  const dlcPersonas = new Set(FUSION_UNLOCKS.dlcPersonas || []);
  const gatedPersonas = FUSION_UNLOCKS.gatedPersonas || {};
  const resultsByArcana = {};
  const ingredientsByArcana = {};
  const personaList = Object.entries(PERSONAS)
    .map(([name, data]) => ({ name, ...data }))
    .sort((left, right) => left.lvl - right.lvl || left.name.localeCompare(right.name));

  personaList.forEach((persona) => {
    if (!ingredientsByArcana[persona.race]) {
      ingredientsByArcana[persona.race] = [];
    }
    ingredientsByArcana[persona.race].push(persona);
    if (!specialPersonas.has(persona.name)) {
      if (!resultsByArcana[persona.race]) {
        resultsByArcana[persona.race] = [];
      }
      resultsByArcana[persona.race].push(persona);
    }
  });

  const getResultArcana = (a1, a2) => (a1 === a2 ? a1 : ARCANA_CHART[a1]?.[a2] || null);
  const createFusionState = (overrides = {}) => ({
    roster: [],
    fusionSettings: { dlcEnabled: true, manualUnlocks: {} },
    socialLinks: { ranks: Object.fromEntries(ARCANA_LIST.map((arcana) => [arcana, 0])) },
    objectives: {},
    linkedEpisodes: { completed: {}, skipped: {} },
    ...overrides
  });
  const isPersonaUnlocked = (name, state) => {
    if (!PERSONAS[name]) {
      return false;
    }
    if ((state.roster || []).includes(name)) {
      return true;
    }
    const settings = state.fusionSettings || { dlcEnabled: true, manualUnlocks: {} };
    if (dlcPersonas.has(name) && settings.dlcEnabled === false) {
      return false;
    }
    const gate = gatedPersonas[name];
    if (!gate) {
      return true;
    }
    if (gate.type === 'social') {
      return (state.socialLinks?.ranks?.[gate.arcana] || 0) >= 10;
    }
    if (gate.type === 'socialAll') {
      return ARCANA_LIST.every((arcana) => {
        const link = SOCIAL_LINKS[arcana];
        return !link || link.automatic || (state.socialLinks?.ranks?.[arcana] || 0) >= 10;
      });
    }
    if (gate.type === 'objective') {
      return Boolean(state.objectives?.[gate.id]);
    }
    if (gate.type === 'linkedEpisode') {
      return Boolean(state.linkedEpisodes?.completed?.[gate.id] || settings.manualUnlocks?.[gate.legacyKey]);
    }
    if (gate.type === 'manual') {
      return Boolean(settings.manualUnlocks?.[gate.key]);
    }
    return true;
  };
  const getAvailableResultsByArcana = (arcana, state) =>
    (resultsByArcana[arcana] || []).filter((persona) => isPersonaUnlocked(persona.name, state));
  const checkTwoIngredientSpecial = (names) => {
    const nameSet = new Set(names);
    return Object.entries(SPECIAL_RECIPES).find(
      ([, ingredients]) => ingredients.length === names.length && ingredients.every((ingredient) => nameSet.has(ingredient))
    )?.[0] || null;
  };
  const fuseSameArcana = (p1, p2, state) => {
    const candidates = getAvailableResultsByArcana(p1.race, state).filter(
      (candidate) => candidate.name !== p1.name && candidate.name !== p2.name
    );
    if (!candidates.length) {
      return null;
    }
    const sumLvl = p1.lvl + p2.lvl;
    let index = -1;
    for (let cursor = candidates.length - 1; cursor >= 0; cursor -= 1) {
      if (sumLvl + 2 >= 2 * candidates[cursor].lvl) {
        index = cursor;
        break;
      }
    }
    if (index < 0) {
      return null;
    }
    if (candidates[index].lvl === p2.lvl) {
      index -= 1;
    }
    return index >= 0 ? candidates[index] : null;
  };
  const selectClosestFusionResult = (resultArcana, targetLevel, p1, p2, state) =>
    getAvailableResultsByArcana(resultArcana, state)
      .filter((candidate) => candidate.name !== p1.name && candidate.name !== p2.name)
      .sort(
        (left, right) =>
          Math.abs(left.lvl - targetLevel) - Math.abs(right.lvl - targetLevel) ||
          left.lvl - right.lvl ||
          left.name.localeCompare(right.name)
      )[0] || null;
  const fuseDyad = (p1, p2, state = createFusionState()) => {
    const special = checkTwoIngredientSpecial([p1.name, p2.name]);
    if (special) {
      return isPersonaUnlocked(special, state) ? { name: special, ...PERSONAS[special] } : null;
    }
    if (p1.race === p2.race) {
      return fuseSameArcana(p1, p2, state);
    }
    const resultArcana = getResultArcana(p1.race, p2.race);
    if (!resultArcana) {
      return null;
    }
    return selectClosestFusionResult(resultArcana, Math.ceil((p1.lvl + p2.lvl) / 2), p1, p2, state);
  };
  const reverseLookup = (targetName, state = createFusionState()) => {
    const target = PERSONAS[targetName];
    if (!target || !isPersonaUnlocked(targetName, state)) {
      return [];
    }
    if (SPECIAL_RECIPES[targetName]) {
      return [{ type: 'special', ingredients: SPECIAL_RECIPES[targetName] }];
    }
    const results = [];
    const seen = new Set();
    for (let i = 0; i < ARCANA_LIST.length; i += 1) {
      for (let j = i; j < ARCANA_LIST.length; j += 1) {
        const a1 = ARCANA_LIST[i];
        const a2 = ARCANA_LIST[j];
        const resultArcana = getResultArcana(a1, a2);
        if (resultArcana !== target.race) {
          continue;
        }
        const list1 = (ingredientsByArcana[a1] || []).filter((persona) => isPersonaUnlocked(persona.name, state));
        const list2 = a1 === a2
          ? list1
          : (ingredientsByArcana[a2] || []).filter((persona) => isPersonaUnlocked(persona.name, state));
        for (const p1 of list1) {
          for (const p2 of list2) {
            if (p1.name === p2.name || (a1 === a2 && p1.lvl >= p2.lvl)) {
              continue;
            }
            const result = fuseDyad(p1, p2, state);
            if (result?.name === targetName) {
              const key = `${p1.name}|${p2.name}`;
              if (!seen.has(key)) {
                seen.add(key);
                results.push({ type: 'normal', p1: p1.name, p2: p2.name });
              }
            }
          }
        }
      }
    }
    return results;
  };

  assert(source.includes('SOON_LEVEL_WINDOW = 5'), 'Roster opportunities should preview the next 5 levels by default');
  assert(source.includes('fusion.level <= currentLevel'), 'Ready roster opportunities must be gated at current player level');
  assert(
    source.includes('fusion.level > currentLevel && fusion.level <= currentLevel + SOON_LEVEL_WINDOW'),
    'Soon roster opportunities must be above current level and within the preview window'
  );

  const defaultState = createFusionState();
  const unlockedSurtState = createFusionState({
    fusionSettings: { dlcEnabled: true, manualUnlocks: { 'junpei-baseball-glove': true } }
  });
  const linkedSurtState = createFusionState({
    linkedEpisodes: { completed: { 'junpei-05': true }, skipped: {} }
  });
  const dlcDisabledState = createFusionState({
    fusionSettings: { dlcEnabled: false, manualUnlocks: {} }
  });
  const dlcDisabledRosterState = createFusionState({
    roster: ['Vanadis'],
    fusionSettings: { dlcEnabled: false, manualUnlocks: {} }
  });
  const socialUnlockedState = createFusionState({
    socialLinks: {
      ranks: {
        ...createFusionState().socialLinks.ranks,
        Chariot: 10
      }
    }
  });
  const objectiveUnlockedState = createFusionState({
    objectives: { 'elizabeth-request-024': true }
  });
  const pairResult = fuseDyad(
    { name: 'Lachesis', ...PERSONAS.Lachesis },
    { name: 'Vanadis', ...PERSONAS.Vanadis },
    defaultState
  );
  assert(pairResult?.name === 'Rangda', 'Lachesis + Vanadis should resolve to Rangda, not Surt');
  assert(
    fuseDyad({ name: 'Lachesis', ...PERSONAS.Lachesis }, { name: 'Vanadis', ...PERSONAS.Vanadis }, unlockedSurtState)?.name === 'Rangda',
    'Unlocked Surt should not change the Lachesis + Vanadis dyad away from Rangda'
  );
  assert(
    reverseLookup('Rangda', defaultState).some((entry) => entry.p1 === 'Lachesis' && entry.p2 === 'Vanadis'),
    'Rangda reverse lookup should include Lachesis + Vanadis'
  );
  assert(
    !reverseLookup('Surt', unlockedSurtState).some((entry) => [entry.p1, entry.p2].includes('Lachesis') && [entry.p1, entry.p2].includes('Vanadis')),
    'Surt reverse lookup should not include Lachesis + Vanadis'
  );
  assert(reverseLookup('Surt', defaultState).length === 0, 'Locked Surt should not expose normal recipes');
  assert(reverseLookup('Surt', unlockedSurtState).some((entry) => entry.type === 'normal'), 'Unlocked Surt should expose normal recipes');
  assert(isPersonaUnlocked('Surt', linkedSurtState), 'Completed Junpei final linked episode should unlock Surt');
  assert(reverseLookup('Surt', linkedSurtState).some((entry) => entry.type === 'normal'), 'Linked-episode-unlocked Surt should expose normal recipes');
  assert(!isPersonaUnlocked('Vanadis', dlcDisabledState), 'DLC-disabled Vanadis should be unavailable by default');
  assert(isPersonaUnlocked('Vanadis', dlcDisabledRosterState), 'Roster-owned Vanadis should stay usable when DLC is disabled');
  assert(
    !reverseLookup('Rangda', dlcDisabledState).some((entry) => [entry.p1, entry.p2].includes('Vanadis')),
    'DLC-disabled reverse lookup should not reference Vanadis when it is not owned'
  );
  assert(!isPersonaUnlocked('Thor', defaultState), 'Social-link-gated Thor should start locked');
  assert(isPersonaUnlocked('Thor', socialUnlockedState), 'Rank 10 Chariot should unlock Thor');
  assert(!isPersonaUnlocked('King Frost', defaultState), 'Objective-gated King Frost should start locked');
  assert(isPersonaUnlocked('King Frost', objectiveUnlockedState), 'Completed Elizabeth request #24 should unlock King Frost');

  const entries = [];
  for (let i = 0; i < personaList.length; i += 1) {
    for (let j = i + 1; j < personaList.length; j += 1) {
      const result = fuseDyad(personaList[i], personaList[j], defaultState);
      if (result) {
        entries.push({ a: personaList[i].name, b: personaList[j].name, result: result.name, level: result.lvl });
      }
    }
  }

  const currentLevel = 64;
  const ready = entries.filter((entry) => entry.level <= currentLevel);
  const soon = entries.filter((entry) => entry.level > currentLevel && entry.level <= currentLevel + 5);

  assert(ready.length > 0, 'Expected at least one ready roster opportunity fixture');
  assert(soon.length > 0, 'Expected at least one soon roster opportunity fixture');
  ready.forEach((entry) => {
    assert(entry.level <= currentLevel, `${entry.result} should not appear under Ready Now above level ${currentLevel}`);
  });
  soon.forEach((entry) => {
    assert(entry.level > currentLevel && entry.level <= currentLevel + 5, `${entry.result} should only appear under Soon within the preview window`);
  });
  entries.forEach((entry) => {
    assert(Boolean(PERSONAS[entry.a]), `Roster opportunity references missing ingredient: ${entry.a}`);
    assert(Boolean(PERSONAS[entry.b]), `Roster opportunity references missing ingredient: ${entry.b}`);
    assert(Boolean(PERSONAS[entry.result]), `Roster opportunity references missing result: ${entry.result}`);
  });

  console.log('Validated roster opportunity level gates.');
}

function validateFullMoonGuideAccuracy(context) {
  const PERSONAS = getGlobal(context, 'PERSONAS');
  const BOSS_STRATS = getGlobal(context, 'BOSS_STRATS');
  const extractPersonaName = (value) => String(value || '').split(' (')[0].trim();
  const strategyText = (strategy) =>
    [
      strategy?.quickTip,
      ...(strategy?.phases || []).flatMap((phase) => [phase.name, phase.tips])
    ]
      .filter(Boolean)
      .join(' ');
  const assertNoText = (strategyName, pattern, message) => {
    assert(!pattern.test(strategyText(BOSS_STRATS[strategyName])), message);
  };

  Object.entries(BOSS_STRATS).forEach(([name, strategy]) => {
    (strategy.personas || []).forEach((persona) => {
      const personaName = extractPersonaName(persona);
      assert(Boolean(PERSONAS[personaName]), `${name} references missing guide persona: ${personaName}`);
    });
  });

  assertNoText('Priestess A', /Priestess is weak to Fire/i, 'Priestess guide should not claim the boss is Fire-weak');
  assertNoText('Hierophant A', /Weak to Strike|Strike weakness/i, 'Hierophant guide should not claim a Strike weakness');
  assertNoText('Lovers A', /Weak to Wind and Pierce|Exploit Wind/i, 'Lovers guide should not claim Wind/Pierce weakness');
  assertNoText('Chariot A', /Weak to Strike and Wind|resists all physical/i, 'Chariot guide should not claim unsupported weakness or physical immunity');
  assertNoText('Hermit A', /Weak to Wind|Exploit Wind/i, 'Hermit guide should not claim a Wind weakness');
  assertNoText('Strength A', /Weak to Ice|Ice weakness/i, 'Strength guide should not claim an Ice weakness');
  assertNoText('Chidori', /Weak to Wind and Ice|Exploit Wind weakness/i, 'Chidori guide should not claim Wind/Ice weakness');

  Object.entries(BOSS_STRATS).forEach(([name, strategy]) => {
    const recLevel = strategy.recLevel || 0;
    if (!recLevel || recLevel >= 80) {
      return;
    }
    const hasAvailablePersona = (strategy.personas || []).some((persona) => {
      const personaData = PERSONAS[extractPersonaName(persona)];
      return personaData && personaData.lvl <= recLevel;
    });
    assert(hasAvailablePersona, `${name} should have at least one Persona suggestion at or below recommended level`);
  });

  console.log('Validated Full Moon boss guide accuracy rules.');
}

function validateStoreRoundtrip(context) {
  const PERSONAS = getGlobal(context, 'PERSONAS');
  const ARCANA_LIST = getGlobal(context, 'ARCANA_LIST');
  const storage = new Map();
  let setItemCalls = 0;
  const localStorageRef = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      setItemCalls += 1;
      storage.set(key, String(value));
    }
  };
  const createDefaultSocialLinksState = () => ({
    ranks: Object.fromEntries(ARCANA_LIST.map((arcana) => [arcana, 0]))
  });
  const createDefaultProfileState = () => ({
    gameDate: { month: 4, day: 7 },
    playerLevel: 1,
    currentFloor: 2,
    stats: { academics: 1, charm: 1, courage: 1 }
  });
  const store = context.createStore({
    validPersonaNames: new Set(Object.keys(PERSONAS)),
    arcanaOrder: ARCANA_LIST,
    createDefaultSocialLinksState,
    createDefaultProfileState,
    localStorageRef
  });

  const initial = store.getState();
  assert(initial.profile.gameDate.month === 4 && initial.profile.gameDate.day === 7, 'Store default date changed');
  assert(initial.roster.length === 0, 'Store default roster should be empty');
  assert(initial.fusionSettings.dlcEnabled === true, 'Store should enable DLC fusion settings by default');
  assert(
    Object.keys(initial.fusionSettings.manualUnlocks).length === 0,
    'Store default manual fusion unlocks should be empty'
  );
  assert(
    Object.keys(initial.linkedEpisodes.completed).length === 0 && Object.keys(initial.linkedEpisodes.skipped).length === 0,
    'Store default linked episode state should be empty'
  );
  const initialPersistCount = setItemCalls;
  store.saveToStorage();
  assert(setItemCalls === initialPersistCount, 'Store should skip redundant localStorage writes');

  store.dispatch({ type: 'ROSTER_ADD', payload: 'Orpheus' });
  store.dispatch({ type: 'ROSTER_ADD', payload: 'Not A Persona' });
  store.dispatch({ type: 'PROFILE_SET_LEVEL', payload: 200 });
  store.dispatch({ type: 'PROFILE_SET_STAT', payload: { stat: 'courage', value: 99 } });
  store.dispatch({ type: 'SOCIALLINKS_SET_RANK', payload: { arcana: 'Magician', value: 12 } });
  store.dispatch({ type: 'OBJECTIVE_SET_COMPLETE', payload: { id: 'old-document-01', complete: true } });
  store.dispatch({ type: 'LINKED_EPISODE_SET_COMPLETE', payload: { id: 'junpei-05', complete: true } });
  store.dispatch({ type: 'LINKED_EPISODE_SET_SKIPPED', payload: { id: 'akihiko-01', skipped: true } });
  store.dispatch({ type: 'FUSION_SET_DLC_ENABLED', payload: false });
  store.dispatch({ type: 'FUSION_SET_MANUAL_UNLOCK', payload: { key: 'junpei-baseball-glove', unlocked: true } });

  const sanitized = store.getState();
  assert(JSON.stringify(sanitized.roster) === JSON.stringify(['Orpheus']), 'Store should reject invalid roster entries');
  assert(sanitized.profile.playerLevel === 99, 'Store should clamp player level');
  assert(sanitized.profile.stats.courage === 6, 'Store should clamp social stat values');
  assert(sanitized.socialLinks.ranks.Magician === 10, 'Store should clamp social-link ranks');
  assert(sanitized.objectives['old-document-01'] === true, 'Store should persist objective completion');
  assert(sanitized.linkedEpisodes.completed['junpei-05'] === true, 'Store should persist linked episode completion');
  assert(sanitized.linkedEpisodes.skipped['akihiko-01'] === true, 'Store should persist linked episode skipped state');
  assert(sanitized.fusionSettings.dlcEnabled === false, 'Store should persist DLC fusion setting');
  assert(
    sanitized.fusionSettings.manualUnlocks['junpei-baseball-glove'] === true,
    'Store should persist manual fusion unlocks'
  );

  const exported = store.exportSave();
  store.dispatch({ type: 'STATE_RESET' });
  store.importSave(exported);
  const restored = store.getState();
  assert(JSON.stringify(restored.roster) === JSON.stringify(exported.roster), 'Store import should restore roster');
  assert(restored.profile.playerLevel === exported.profile.playerLevel, 'Store import should restore profile');
  assert(restored.linkedEpisodes.completed['junpei-05'] === true, 'Store import should restore linked episode completion');
  assert(restored.linkedEpisodes.skipped['akihiko-01'] === true, 'Store import should restore linked episode skipped state');
  assert(restored.fusionSettings.dlcEnabled === exported.fusionSettings.dlcEnabled, 'Store import should restore DLC fusion setting');
  assert(
    restored.fusionSettings.manualUnlocks['junpei-baseball-glove'] === true,
    'Store import should restore manual fusion unlocks'
  );

  let rejected = false;
  try {
    store.importSave({ version: 1, roster: 'bad', socialLinks: {} });
  } catch (error) {
    rejected = true;
  }
  assert(rejected, 'Store import should reject invalid payloads');

  console.log('Validated store defaults, sanitization, and save import/export.');
}

function validateBrowserEntrypoints() {
  const documentStub = {
    readyState: 'loading',
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
    createElement() {
      return {
        setAttribute() {},
        appendChild() {},
        classList: { add() {}, remove() {}, toggle() {} },
        dataset: {},
        style: {}
      };
    },
    body: {
      appendChild() {},
      removeChild() {}
    }
  };
  const context = createContext({
    document: documentStub,
    navigator: { clipboard: { writeText: async () => {} } },
    Blob: class Blob {},
    URL: {
      createObjectURL() {
        return 'blob:test';
      },
      revokeObjectURL() {}
    },
    btoa(value) {
      return Buffer.from(String(value), 'binary').toString('base64');
    },
    atob(value) {
      return Buffer.from(String(value), 'base64').toString('binary');
    },
    Event: class Event {}
  });

  [
    'data/enemies.js',
    'data/personas.js',
    'data/social-links.js',
    'data/social-links-verified.js',
    'data/linked-episodes.js',
    'data/tartarus-extra.js',
    'data/tartarus-chest-loot.js',
    'data/personas-extra.js',
    'data/fusion-unlocks.js',
    'data/social-links-extra.js',
    'data/requests-extra.js',
    'data/elizabeth-requests.js',
    'js/store.js',
    'js/run-state.js',
    'js/social-link-rules.js',
    'js/linked-episode-advisor.js',
    'js/social-link-advisor.js',
    'js/planner.js',
    'js/requests.js',
    'js/tartarus.js',
    'js/velvet.js',
    'js/social-links.js',
    'js/app.js'
  ].forEach((path) => runScript(context, path));

  [
    'createStore',
    'mountRunStatePanel',
    'getSocialLinkDefinition',
    'getSocialLinkAvailability',
    'initPlanner',
    'initRequests',
    'initTartarus',
    'initVelvet',
    'initSocialLinks'
  ].forEach((name) => {
    assert(typeof context[name] === 'function', `Browser entrypoint did not register ${name}`);
  });
  assert(context.socialLinkAdvisor && typeof context.socialLinkAdvisor.getTopModelForDate === 'function', 'Social-link advisor did not register');
  assert(context.linkedEpisodeAdvisor && typeof context.linkedEpisodeAdvisor.getTopModelForDate === 'function', 'Linked-episode advisor did not register');

  console.log('Validated browser script load order and public entrypoints.');
}

function runSocialLinkValidator() {
  const result = spawnSync(process.execPath, ['scripts/validate-social-links.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

runSocialLinkValidator();

const dataContext = loadDataContext();
runScript(dataContext, 'js/store.js');

validateEncoding();
validatePersonas(dataContext);
validateEnemies(dataContext);
validateRequests(dataContext);
validateTartarusObjectives(dataContext);
validateTartarusChestLoot(dataContext);
validateLinkedEpisodes(dataContext);
validateLinkedEpisodeAdvisor();
validateStaleDeadlineFiltering(dataContext);
validateFusionRecommendationLevelGates(dataContext);
validateRosterOpportunityLevelGates(dataContext);
validateFullMoonGuideAccuracy(dataContext);
validateStoreRoundtrip(dataContext);
validateBrowserEntrypoints();

if (failures.length) {
  console.error('Project validation failed:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Project validation passed.');
