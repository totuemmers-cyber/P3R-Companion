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
assert(JSON.stringify(aeon.availableDays) === JSON.stringify([5]), 'Aeon should only be available on Friday');

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

if (failures.length) {
  console.error('Social Link validation failed:\n' + failures.map((entry) => `- ${entry}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${Object.keys(SOCIAL_LINKS).length} Social Links.`);
