// P3R Companion - Curated Social Link Planning Notes

const SOCIAL_LINK_EXTRAS = {
  Fool: {
    priority: 'Automatic story link. No manual scheduling required.',
    notes: ['Treat this as a progression check, not a calendar decision.']
  },
  Magician: {
    priority: 'Fast early-school link with no stat gate.',
    deadline: 'Best grown before late-game school scheduling gets crowded.',
    routeNote: 'Friendship only.',
    notes: ['Strong filler on ordinary school days when higher-pressure links are unavailable.']
  },
  Priestess: {
    priority: 'Reliable midgame school link once Fuuka joins.',
    routeNote: 'Romance-capable in the late ranks.',
    notes: ['Good daytime use when you want Priestess arcana coverage for fusion bonus.']
  },
  Empress: {
    priority: 'Late, high-value school link with a strict Academics gate.',
    deadline: 'Starts late enough that every open school day matters.',
    routeNote: 'Romance-capable in the late ranks.',
    notes: ['Push Academics early if you do not want Mitsuru competing with January links.']
  },
  Emperor: {
    priority: 'Student Council route with a Courage gate and strong midgame value.',
    deadline: 'Worth opening as soon as the stat gate is met.',
    routeNote: 'Friendship only.',
    notes: ['Useful stepping stone because it opens another school link chain.']
  },
  Hierophant: {
    priority: 'One of the safest Sunday links to progress steadily.',
    deadline: 'Low pressure, but it competes directly with other Sunday links.',
    routeNote: 'Friendship only.',
    notes: ['Great fallback when school-day scheduling is crowded.']
  },
  Lovers: {
    priority: 'Top-tier late-game school link with a max Charm gate.',
    deadline: 'Unlocks late and should be treated as a premium daytime slot.',
    routeNote: 'Romance-capable in the late ranks.',
    notes: ['If Charm lags, this is one of the most painful late unlocks to recover.']
  },
  Chariot: {
    priority: 'Easy early athletic link with no major setup cost.',
    routeNote: 'Friendship only.',
    notes: ['Strong early-game school filler before stat-gated links come online.']
  },
  Justice: {
    priority: 'Steady school link with long-term value and easy calendar fit.',
    routeNote: 'Romance-capable in the late ranks.',
    notes: ['A good medium-priority route when high-pressure links are unavailable.']
  },
  Hermit: {
    priority: 'Excellent Sunday pressure valve because it is remote and easy to access.',
    deadline: 'High-value Sunday competitor, especially before Sun opens.',
    routeNote: 'Friendship only.',
    notes: ['Very efficient when you want to preserve school weekdays for daytime links.']
  },
  Fortune: {
    priority: 'Solid school-day club link with low friction.',
    routeNote: 'Friendship only.',
    notes: ['Useful when you want Fortune coverage without spending a Sunday slot.']
  },
  Strength: {
    priority: 'Consistent early-to-mid school link with good availability.',
    routeNote: 'Romance-capable in the late ranks.',
    notes: ['Easy to fit into the calendar and good to raise before late unlocks arrive.']
  },
  Hanged: {
    priority: 'Child social link with notable daytime opportunity cost.',
    deadline: 'Do not leave this entirely to late game because school-day pressure grows.',
    routeNote: 'Friendship only.',
    notes: ['Often competes with school links; use weekends and lighter weeks efficiently.']
  },
  Death: {
    priority: 'Automatic night story link. No manual scheduling required.',
    notes: ['Track it for fusion value, but it does not consume planning bandwidth.']
  },
  Temperance: {
    priority: 'High-value school link gated behind another school chain and stats.',
    deadline: 'Open it as soon as requirements are met so it does not pile onto late school weeks.',
    routeNote: 'Friendship only.',
    notes: ['One of the easiest links to delay accidentally because its unlock is layered.']
  },
  Devil: {
    priority: 'Useful evening link when daytime is overloaded.',
    deadline: 'Lower pressure than school links, but excellent for converting spare evenings.',
    routeNote: 'Friendship only.',
    notes: ['Good fallback when your day slot is more contested than your night slot.']
  },
  Tower: {
    priority: 'Evening link with solid late-game value.',
    deadline: 'Fits best when daytime links dominate your planning.',
    routeNote: 'Friendship only.',
    notes: ['Best treated as a night-slot specialist rather than a main calendar pressure point.']
  },
  Star: {
    priority: 'Sunday-exclusive link that competes directly with Hermit and Sun.',
    deadline: 'Plan Sundays intentionally once this opens.',
    routeNote: 'Friendship only.',
    notes: ['Very easy to underschedule if Sundays are being spent reactively.']
  },
  Moon: {
    priority: 'Daytime non-school link that can soak up spare afternoons.',
    routeNote: 'Friendship only.',
    notes: ['Useful when school links are blocked by exams, vacation shifts, or stat gates.']
  },
  Sun: {
    priority: 'One of the highest-pressure links in the game because of its narrow window.',
    deadline: 'Treat as a premium Sunday route with a hard seasonal cutoff.',
    routeNote: 'Friendship only.',
    notes: ['If Akinari is available, he should usually beat generic Sunday filler.']
  },
  Judgement: {
    priority: 'Automatic late-story link.',
    notes: ['Track for fusion completion only; no manual planning needed.']
  },
  Aeon: {
    priority: 'Extremely late high-value route with a short final window.',
    deadline: 'One of the most urgent endgame links once it opens.',
    routeNote: 'Romance-capable in the late ranks.',
    notes: ['January daytime slots become very expensive once this is available.']
  }
};

const SOCIAL_STAT_ACTIVITY_GUIDES = {
  academics: [
    { name: 'School library or dorm study', note: 'Reliable low-risk study option when no high-priority social link is available.' },
    { name: 'Game Parade quiz machines', note: 'Fast spike option when you need to push to the next Academics tier.' },
    { name: 'Exam-week prep windows', note: 'Use quiet calendar periods to bank Academics before Mitsuru or school-gated links open.' }
  ],
  charm: [
    { name: 'Cafe and town charisma spots', note: 'Good background Charm progress when your day slot is already committed.' },
    { name: 'Game Parade style/print activities', note: 'Best used when pushing for Lovers or other appearance-gated routes.' },
    { name: 'Low-pressure evening filler', note: 'Charm is often easiest to clean up with spare night slots.' }
  ],
  courage: [
    { name: 'Wakatsu or other bravery-themed food options', note: 'Reliable way to chip away at Courage gates without spending a daytime link.' },
    { name: 'Game Parade horror activities', note: 'Best when you want a focused Courage jump for Emperor or other unlocks.' },
    { name: 'Risky/oddball school opportunities', note: 'Use these when daytime efficiency matters more than comfort.' }
  ]
};
