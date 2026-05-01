import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = {
  console,
  window: {}
};
vm.createContext(context);

for (const file of ['data/personas.js', 'data/social-links.js', 'data/social-links-verified.js', 'js/social-link-rules.js', 'js/social-link-advisor.js']) {
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
}

const SOCIAL_LINKS = vm.runInContext('SOCIAL_LINKS', context);
const getDefinition = context.window.getSocialLinkDefinition;
const getAvailability = context.window.getSocialLinkAvailability;
const getAvailabilityCategory = context.window.getSocialLinkAvailabilityCategory;
const formatAvailabilityCount = context.window.formatSocialLinkAvailabilityCount;
const advisor = context.window.socialLinkAdvisor;

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function assertDate(label, actual, month, day) {
  assert(actual?.month === month && actual?.day === day, `${label} expected ${month}/${day}, got ${actual?.month}/${actual?.day}`);
}

for (const [arcana, link] of Object.entries(SOCIAL_LINKS)) {
  if (!link.guideVersion) {
    continue;
  }

  assert(Boolean(link.guideSource), `${arcana} is missing guideSource`);

  for (const rank of link.ranks || []) {
    if (rank.rank >= 2 && rank.rank <= 10 && !rank.answers) {
      assert(Boolean(rank.note), `${arcana} rank ${rank.rank} is missing a no-effect note`);
    }

    for (const answer of rank.answers || []) {
      assert(Boolean(answer.prompt), `${arcana} rank ${rank.rank} has an empty prompt`);
      for (const option of answer.options || []) {
        assert(
          !/Enter a Dating Relationship|Enter a Platonic|Potential romance flag|Romance trigger|Platonic trigger/i.test(
            option.text
          ),
          `${arcana} rank ${rank.rank} still contains editorial text: ${option.text}`
        );
        if (option.branchTag) {
          assert(Boolean(option.branchLabel), `${arcana} rank ${rank.rank} branch option is missing a label`);
        }
      }
    }
  }
}

const priestess = getDefinition('Priestess');
assertDate('Priestess unlock date', priestess.unlockDate, 6, 22);
assert(JSON.stringify(priestess.availableDays) === JSON.stringify([1, 3, 4, 6]), 'Priestess days mismatch');

const lovers = getDefinition('Lovers');
assertDate('Lovers unlock date', lovers.unlockDate, 7, 24);
assert(JSON.stringify(lovers.availableDays) === JSON.stringify([1, 3, 4, 6]), 'Lovers days mismatch');

const justice = getDefinition('Justice');
assertDate('Justice unlock date', justice.unlockDate, 4, 27);
assert(Object.keys(justice.statRequirements || {}).length === 0, 'Justice should not have a stat gate');

const aeon = getDefinition('Aeon');
assert(JSON.stringify(aeon.availableDays) === JSON.stringify([1, 2, 3, 4, 5, 6]), 'Aeon should be available Monday through Saturday');

const expectedManualDayCounts = {
  Magician: 3,
  Priestess: 4,
  Empress: 3,
  Emperor: 6,
  Hierophant: 6,
  Lovers: 4,
  Chariot: 4,
  Justice: 3,
  Hermit: 1,
  Fortune: 3,
  Strength: 2,
  Hanged: 3,
  Temperance: 3,
  Devil: 2,
  Tower: 4,
  Star: 3,
  Moon: 7,
  Sun: 1,
  Aeon: 6
};

for (const [arcana, expectedCount] of Object.entries(expectedManualDayCounts)) {
  const link = getDefinition(arcana);
  const category = getAvailabilityCategory(link);
  assert(category.dayCount === expectedCount, `${arcana} expected ${expectedCount} available days, got ${category.dayCount}`);
}

const moon = getDefinition('Moon');
const moonCategory = getAvailabilityCategory(moon);
assert(JSON.stringify(moon.availableDays) === JSON.stringify([0, 1, 2, 3, 4, 5, 6]), 'Moon should be available every weekday');
assert(moonCategory.category === 'daily' && !moonCategory.isScarce, `Moon should be daily, got ${moonCategory.category}`);
assert(formatAvailabilityCount(moon) === 'Available daily', `Moon daily formatter mismatch: ${formatAvailabilityCount(moon)}`);

const hierophantCategory = getAvailabilityCategory(getDefinition('Hierophant'));
assert(hierophantCategory.category === 'broad' && !hierophantCategory.isScarce, 'Hierophant should be broad, not scarce');
const towerCategory = getAvailabilityCategory(getDefinition('Tower'));
assert(towerCategory.category === 'broad' && !towerCategory.isScarce, 'Tower should be broad, not scarce');

const tower = getDefinition('Tower');
assert(
  (tower.prerequisites || []).some((entry) => entry.type === 'rank' && entry.arcana === 'Strength' && entry.minRank === 4),
  'Tower should require Strength rank 4'
);

const priestessLocked = getAvailability(
  'Priestess',
  {
    profile: { gameDate: { month: 6, day: 21 }, stats: { academics: 1, charm: 1, courage: 6 } },
    socialLinks: { ranks: { Fortune: 1, Priestess: 0 } }
  },
  { month: 6, day: 21 },
  'day'
);
assert(priestessLocked.status === 'before_unlock', 'Priestess should be locked before June 22');

const priestessStartable = getAvailability(
  'Priestess',
  {
    profile: { gameDate: { month: 6, day: 24 }, stats: { academics: 1, charm: 1, courage: 6 } },
    socialLinks: { ranks: { Fortune: 1, Priestess: 0 } }
  },
  { month: 6, day: 24 },
  'day'
);
assert(
  priestessStartable.status === 'setup_needed' && priestessStartable.actionable === true,
  'Priestess should be actionable once unlocked and requirements are met'
);

const chariotStartable = getAvailability(
  'Chariot',
  {
    profile: { gameDate: { month: 4, day: 24 }, stats: { academics: 1, charm: 1, courage: 1 } },
    socialLinks: { ranks: { Chariot: 0 } }
  },
  { month: 4, day: 24 },
  'day'
);
assert(
  chariotStartable.status === 'setup_needed' && chariotStartable.actionable === true,
  'Manual rank 0 links should surface as actionable start events'
);

const moonStartedSnapshot = {
  profile: { gameDate: { month: 8, day: 3 }, stats: { academics: 4, charm: 2, courage: 4 } },
  socialLinks: { ranks: { Magician: 3, Moon: 1 } }
};
const moonWeekDates = [
  { month: 8, day: 3 },
  { month: 8, day: 4 },
  { month: 8, day: 5 },
  { month: 8, day: 6 },
  { month: 8, day: 7 },
  { month: 8, day: 8 },
  { month: 8, day: 9 }
];
for (const date of moonWeekDates) {
  const availability = getAvailability('Moon', moonStartedSnapshot, date, 'day');
  assert(availability.available === true, `Moon should be available on ${date.month}/${date.day}, got ${availability.status}`);
}

function makeSnapshot({ month, day, stats, roster = [], ranks = {} }) {
  return {
    roster,
    profile: {
      gameDate: { month, day },
      playerLevel: 20,
      currentFloor: 54,
      stats
    },
    socialLinks: {
      ranks: Object.fromEntries(
        Object.keys(SOCIAL_LINKS).map((arcana) => [arcana, ranks[arcana] || 0])
      )
    },
    objectives: {}
  };
}

const summerSnapshot = makeSnapshot({
  month: 7,
  day: 28,
  stats: { academics: 4, charm: 5, courage: 5 },
  roster: ['Nekomata', 'Apsaras', 'Angel'],
  ranks: { Magician: 4, Chariot: 3, Priestess: 2, Hermit: 4, Emperor: 2 }
});
const summerDayPick = advisor.getTopModelForDate(summerSnapshot, { timeSlot: 'day', focusMode: 'balanced' });
assert(summerDayPick?.arcana === 'Hierophant', `Expected July 28 daytime pick to be Hierophant, got ${summerDayPick?.arcana}`);
const summerEveningPick = advisor.getTopModelForDate(summerSnapshot, { timeSlot: 'evening', focusMode: 'balanced' });
assert(summerEveningPick?.arcana === 'Devil', `Expected July 28 evening pick to be Devil, got ${summerEveningPick?.arcana}`);

const plannerPressureSnapshot = makeSnapshot({
  month: 6,
  day: 24,
  stats: { academics: 3, charm: 4, courage: 4 },
  roster: ['Nekomata', 'Apsaras', 'Angel'],
  ranks: { Magician: 3, Chariot: 2, Hermit: 4 }
});
const blockedBalanced = advisor.getBlockedImportantModel(plannerPressureSnapshot, {
  timeSlot: 'day',
  focusMode: 'balanced'
});
assert(blockedBalanced?.arcana === 'Priestess', `Expected June 24 blocked daytime risk to be Priestess, got ${blockedBalanced?.arcana}`);
const blockedCompletionWhy = advisor.getRecommendationWhy(blockedBalanced, { focusMode: 'completion' });
assert(
  /Critical path for Orpheus Telos\./.test(blockedCompletionWhy),
  `Expected completion warning copy for Priestess, got: ${blockedCompletionWhy}`
);
const strengthBalanced = advisor.getTopModelForDate(plannerPressureSnapshot, {
  timeSlot: 'day',
  focusMode: 'balanced'
});
assert(strengthBalanced?.arcana === 'Strength', `Expected June 24 daytime pick to be Strength, got ${strengthBalanced?.arcana}`);
const strengthCompletion = advisor.getTopModelForDate(plannerPressureSnapshot, {
  timeSlot: 'day',
  focusMode: 'completion'
});
assert(strengthCompletion?.arcana === 'Strength', `Expected June 24 completion pick to stay Strength, got ${strengthCompletion?.arcana}`);

const scarcitySnapshot = makeSnapshot({
  month: 5,
  day: 3,
  stats: { academics: 4, charm: 4, courage: 4 },
  roster: ['Nekomata', 'Apsaras', 'Angel'],
  ranks: { Magician: 3, Moon: 1, Hermit: 1, Strength: 4 }
});
const moonModel = advisor.getModel(scarcitySnapshot, { arcana: 'Moon', focusMode: 'balanced' });
assert(!moonModel.isRare && !moonModel.isScarce, 'Moon should not be flagged rare/scarce');
const moonWhy = advisor.getRecommendationWhy(moonModel, { focusMode: 'balanced' });
assert(/Available daily/.test(moonWhy), `Moon should use neutral daily wording, got: ${moonWhy}`);
assert(!/\bOnly\s+7\b|rare|scarce/i.test(moonWhy), `Moon recommendation should not use scarce wording, got: ${moonWhy}`);
assert(!moonModel.factors.some((factor) => /\bOnly\s+7\b|rare|scarce/i.test(factor)), `Moon factors should not use scarce wording: ${moonModel.factors.join(' | ')}`);

for (const arcana of ['Hierophant', 'Tower']) {
  const model = advisor.getModel(scarcitySnapshot, { arcana, focusMode: 'balanced' });
  assert(!model.isRare && !model.isScarce, `${arcana} includes Sunday but should not be rare/scarce`);
  const why = advisor.getRecommendationWhy(model, { focusMode: 'balanced' });
  assert(!/rare|scarce|Only\s+[4-7]\s+days?/i.test(why), `${arcana} should not emit rare/broad-only wording, got: ${why}`);
}

const hermitModel = advisor.getModel(scarcitySnapshot, { arcana: 'Hermit', focusMode: 'balanced' });
const hermitWhy = advisor.getRecommendationWhy(hermitModel, { focusMode: 'balanced' });
assert(hermitModel.isScarce && /Only 1 day each week\./.test(hermitWhy), `Hermit should still get scarcity wording, got: ${hermitWhy}`);

const allRecommendationModels = advisor.getModels(scarcitySnapshot, { focusMode: 'balanced' });
for (const model of allRecommendationModels) {
  const strings = [
    advisor.getRecommendationWhy(model, { focusMode: 'balanced' }),
    advisor.getRecommendationWhy(model, { focusMode: 'completion' }),
    ...model.factors,
    ...model.tags
  ].filter(Boolean);
  for (const text of strings) {
    assert(!/\bOnly\s+[4-9]\s+days?/i.test(text), `${model.arcana} emitted invalid broad-only wording: ${text}`);
  }
}

if (failures.length) {
  console.error('Social Link validation failed:\n' + failures.map((entry) => `- ${entry}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${Object.keys(SOCIAL_LINKS).length} Social Links.`);
