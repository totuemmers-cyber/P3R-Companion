// P3R Companion - Persona fusion availability gates

const FUSION_UNLOCKS = {
  dlcPersonas: [
    'Arsene',
    'Captain Kidd',
    'Carmen',
    'Cendrillon',
    'Goemon',
    'Izanagi',
    'Johanna',
    'Kaguya',
    'Magatsu-Izanagi',
    'Milady',
    'Robin Hood',
    'Satanael',
    'Vanadis',
    'Zorro'
  ],
  gatedPersonas: {
    Alilat: { type: 'social', arcana: 'Empress', label: 'Mitsuru Social Link Rank 10' },
    Arahabaki: { type: 'social', arcana: 'Hermit', label: 'Maya Social Link Rank 10' },
    Asura: { type: 'social', arcana: 'Sun', label: 'Akinari Social Link Rank 10' },
    Atavaka: { type: 'social', arcana: 'Strength', label: 'Yuko Social Link Rank 10' },
    Attis: { type: 'social', arcana: 'Hanged', label: 'Maiko Social Link Rank 10' },
    Beelzebub: { type: 'social', arcana: 'Devil', label: 'Tanaka Social Link Rank 10' },
    'Chi You': { type: 'social', arcana: 'Tower', label: 'Mutatsu Social Link Rank 10' },
    Cybele: { type: 'social', arcana: 'Lovers', label: 'Yukari Social Link Rank 10' },
    Helel: { type: 'social', arcana: 'Star', label: 'Mamoru Social Link Rank 10' },
    Kohryu: { type: 'social', arcana: 'Hierophant', label: 'Hierophant Social Link Rank 10' },
    Lakshmi: { type: 'social', arcana: 'Fortune', label: 'Keisuke Social Link Rank 10' },
    Metatron: { type: 'social', arcana: 'Aeon', label: 'Aigis Social Link Rank 10' },
    Odin: { type: 'social', arcana: 'Emperor', label: 'Hidetoshi Social Link Rank 10' },
    'Orpheus Telos': { type: 'socialAll', label: 'All Social Links Rank 10' },
    Sandalphon: { type: 'social', arcana: 'Moon', label: 'Nozomi Social Link Rank 10' },
    Thor: { type: 'social', arcana: 'Chariot', label: 'Kazushi Social Link Rank 10' },
    Yurlungur: { type: 'social', arcana: 'Temperance', label: 'Bebe Social Link Rank 10' },

    'King Frost': { type: 'objective', id: 'elizabeth-request-024', label: 'Elizabeth Request #24 reward' },
    'Hua Po': { type: 'objective', id: 'elizabeth-request-077', label: 'Elizabeth Request #77 reward' },
    Nebiros: { type: 'objective', id: 'elizabeth-request-049', label: 'Elizabeth Request #49 reward' },
    Thoth: { type: 'objective', id: 'elizabeth-request-078', label: 'Elizabeth Request #78 reward' },
    Lucifer: { type: 'objective', id: 'elizabeth-request-081', label: 'Elizabeth Request #81 reward' },
    Masakado: { type: 'objective', id: 'elizabeth-request-087', label: 'Elizabeth Request #87 reward' },

    Surt: { type: 'linkedEpisode', id: 'junpei-05', legacyKey: 'junpei-baseball-glove', label: "Junpei Linked Episode 5: Baseball Glove" },
    Horus: { type: 'linkedEpisode', id: 'akihiko-05', legacyKey: 'akihiko-hand-wraps', label: "Akihiko Linked Episode 5: Hand Wraps" },
    Byakko: { type: 'linkedEpisode', id: 'koromaru-05', legacyKey: 'koromaru-collar', label: "Koromaru Linked Episode 5: Koromaru's Collar" },
    Michael: { type: 'linkedEpisode', id: 'ken-05', legacyKey: 'ken-silver-key', label: "Ken Linked Episode 5: Silver Key" },
    'Hell Biker': { type: 'linkedEpisode', id: 'shinjiro-05', legacyKey: 'shinjiro-incomplete-form', label: 'Shinjiro Linked Episode 5: Incomplete Form' },
    Saturnus: { type: 'linkedEpisode', id: 'ryoji-05', legacyKey: 'ryoji-music-box', label: 'Ryoji Linked Episode 5: Music Box' },
    Mothman: { type: 'manual', key: 'sky-overseer-vibrant-feather', label: 'Yabbashah 82F: Vibrant Feather' },
    Decarabia: { type: 'manual', key: 'isolated-castle-pentagram-stone', label: 'Tziah 143F: Pentagram Stone' },
    Lilith: { type: 'manual', key: 'necromachinery-lily-petal', label: 'Necromachinery: Lily Petal' },
    Houou: { type: 'manual', key: 'minotaur-nulla-phoenix-tail', label: 'Minotaur Nulla: Phoenix Tail' }
  }
};
