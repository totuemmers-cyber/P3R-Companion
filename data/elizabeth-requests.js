// P3R Companion - Elizabeth requests

(() => {
const ELIZABETH_REQUEST_ROWS = [
  [1, "Bring me a Muscle Drink", "Available 5/10, No Deadline", "Soul Drop x5", "Muscle Drink can be bought at Aohige Pharmacy. It can also be found in Tartarus.", ""],
  [2, "Retrieve the first Old Document", "Available 5/10, No Deadline", "10000 Yen", "Get to the top of the Thebel Block of Tartarus (Floor 22) and open the purple treasure chest.", ""],
  [3, "Shadow Hunting Milestone", "Available 5/10, No Deadline", "Cure Water x3", "Defeat a total of 100 Shadows.", ""],
  [4, "Treasure Hunting Milestone", "Available 5/10, No Deadline", "Snuff Soul x2", "Open a total of 50 treasure chests.", ""],
  [5, "Create a Persona that's level 13 or above", "Available 5/10, No Deadline", "Bufula Gem x3", "Fuse or find a Persona that's Level 13 or higher to complete this request.", ""],
  [6, "Create a Persona with Kouha", "Available 5/10, No Deadline", "Fierce Sutra", "Fuse any Persona that knows Kouha, then show it to Elizabeth.", "Complete \"Quest 5 - Create a Persona that's level 13 or above.\""],
  [7, "Bring me a Juzumaru", "Available 5/10, no Deadline", "Makouha (Skill Card)", "Juzumaru can be found on Tartarus Floor 36 in the treasure chest after defeating the boss. Show the sword to Elizabeth to complete the request.", ""],
  [8, "Experiment with fortune telling", "Available 5/10, No Deadline", "Speed Incense I x3", "You will need to raise your courage so that you can access Club Escapade. Go there and pay the fortune teller for the Rarity Fortune, and then go and fight in Tartarus to complete this request.", ""],
  [9, "I'd like to try all kind of drinks", "Available 5/10, No Deadline", "Media (Skill Card)", "You will need to collect 12 different types of drinks from vending machines and bring them to Elizabeth. Vending Machine 1: Iwatodai Strip Mall - 3F", "Complete \"Quest 9 - I'd like to try all kind of drinks.\""],
  [10, "I'd like to try a beef bowl", "Available 5/10, no Deadline", "Male Uniforms (W)", "To complete this quest you will need to become a Umiushi Member. You can do this by buying the Umiushi Fan Book from the Manga Star Netcafe. Use the book on the shared computer, and then order a beef bowl from Umiushi Beef Bowls and bring it to Elizabeth to complete the request.", ""],
  [11, "Please prevail in the Big Eater Challenge", "Available 5/10, No Deadline", "Twilight Fragment x3", "Wilduck Burgers will host the Big Eater Challenge on weekends. However, completing the challenge also requires picking the right choices, so try the follow option and you should able to complete the challenge. Look away from the burgers", "Complete \"Quest 1 - Bring me a Muscle Drink.\""],
  [12, "Bring me pine resin", "Available 5/10, Deadline 6/6", "Toy Bow for Yukari", "Talk to Yukari to get a Pine Resin, and bring it to Elizabeth to complete the request.", ""],
  [13, "Bring me a handheld game console", "Available 5/10, Deadline 6/6", "Pixel Vest (Armor - Male Only)", "Talk to Junpei to get a Handheld Console from him. Bring the console to Elizabeth to complete the request.", "Complete \"Quest 12 - Bring me pine resin.\""],
  [14, "Retrieve the second old document", "Available 5/10, No Deadline", "20000 Yen", "Get to Arqa Block of Tartarus (Floor 43) and open the purple treasure chest.", ""],
  [15, "Shadow Hunting Milestone #2", "Available 5/10, No Deadline", "Umugi Water x3", "Defeat a total of 200 Shadows.", "Complete \"Quest 3 - Shadow Hunting Milestone.\""],
  [16, "Treasure Hunting Milestone #2", "Available 5/10, No Deadline", "Chewing Soul x2", "Open a total of 100 treasure chests.", "Complete \"Quest 4 - Treasure Hunting Milestone.\""],
  [17, "Fusion Series #1: Emperor, Oberon", "Available 5/10, No Deadline", "Female Uniforms (W)", "The easiest way to get this quest done is to raise the Emperor Social Link to at least rank 2. Then fuse a persona(Valkyrie + Jack Frost) into Oberon, the exp bonus should give Oberon Mazio.", "Complete \"Quest 5 - Create a Persona that's level 13 or above.\""],
  [18, "I'd like to be gifted a bouquet of flowers", "Available 6/13, No Deadline", "Female Winter Garb", "Bring Elizabeth a Rose Bouquet. One of them can be ordered from Shopping TV on May 3rd. Or you can buy them for 2000 Yen at the Florist in Port Island Station.", ""],
  [19, "I want Jack Frost Dolls", "Available 6/13, No Deadline", "Twilight Fragment x3", "Jack Frost Dolls can be found by playing the crane machine next to the game store in Paulownia Mall. Elizabeth wants 3 of them.", ""],
  [20, "Bring me some potent medicine", "Available 6/13, No Deadline", "Steel Pipe (Weapon for MC)", "Go to the Nurse's office in the school to get the Potent Medicine. Bring the medicine to Elizabeth to complete the request.", ""],
  [21, "Retrieve the third old document", "Available 6/13, No Deadline", "30000 Yen", "Get to the top Arqa Block of Tartarus (Floor 69) and open the purple treasure chest.", "Complete \"Quest 14 - Retrieve the second old document\""],
  [22, "Shadow Hunting Milestone #3", "Available 5/10, No Deadline", "Bead x3", "Defeat a total of 300 Shadows.", "Complete \"Quest 15 - Shadow Hunting Milestone #2.\""],
  [23, "Persona Fusion Milestone", "Available 6/13, No Deadline", "Twilight Fragment x5", "Conduct a total of 20 Persona fusions.", ""],
  [24, "Create a Persona that's level 23 or above", "Available 6/13, No Deadline", "Sugar Key", "Have a Persona that is level 23 or higher in your possession and report to Elizabeth.", ""],
  [25, "Fusion Series #2 Chariot, Mithras", "Available 5/10, No Deadline", "Male Winter Garb", "To complete this quest you need to make a Mithras that is level 26 or higher. First, raise the Chariot Social Link to rank 5. Then Use the Persona search to find Mithras, a combination that works is Oberon and Tam Lin. The fusion exp should give you enough exp to put Mithras to level 26.", "Complete \"Quest 17 - Fusion Series #1: Emperor, Oberon.\""],
  [26, "Bring me an Onimaru Kunitsuna", "Available 6/13, No Deadline", "Crit Rate Boost (Skill Card)", "You can find Onimaru Kunitsuna by clearing the boss on Tartarus Floor 54 and then opening the rare chest with Twilight Fragments.", ""],
  [27, "Bring me a triangular sword", "Available 6/13, Deadline 7/5", "Gallant Sneakers", "Talk to Mitsuru to get the sword and bring it to Elizabeth.", ""],
  [28, "I want to look fashionable", "Available 6/13, Deadline 7/5", "Spiked Bat", "Talk to Akihiko to get the protein and bring it to Elizabeth.", "Complete \"Bring me a triangular sword.\""],
  [29, "I want to look fashionable", "Available 6/13, Deadline 7/5", "Power Incense x5", "Talk to the accessory seller in Club Escapade. There are two ways to complete the quest from here, you can pay the guy 150,000 Yen for the glasses, or you can look for a Black Quartz. Getting a Black Quartz, the seller will discount the glasses to 10000 yen. Black Quartz is dropped by Lustful Snake in the Arqa Block (Floor 57 or higher in Tartarus). Another source of Black Quartz is the boss on floor 60 of Tartarus. If you still have trouble finding it, rescuing the missing person on floor 64 also gives 2 Black Quartz.", ""],
  [30, "Retrieve the fourth old document", "Available 7/09, No Deadline", "40000 Yen", "Get to the Yabbashah Block of Tartarus (Floor 91) and open the purple treasure chest.", "Complete \"Quest 21 - Retrieve the third old document\""],
  [31, "Shadow Hunting Milestone #4", "Available 5/10, No Deadline", "Kamimusubi Water x2", "Defeat a total of 450 Shadows.", "Complete \"Quest 22 - Shadow Hunting Milestone #3.\""],
  [32, "Treasure Hunting Milestone #3", "Available 5/10, No Deadline", "Snuff Soul x6", "Open a total of 150 treasure chests.", "Complete \"Quest 16 - Treasure Hunting Milestone #2.\""],
  [33, "Persona Fusion Milestone #2", "Available 6/13, No Deadline", "Twilight Fragment x5", "Conduct a total of 35 Persona fusions.", "Complete \"Quest 23 - Persona Fusion Milestone .\""],
  [34, "Create a Persona with Torrent Shot", "Available 7/09, No Deadline", "Attack Mirror x3", "Fuse any Persona that knows Torrent Shot, then show it to Elizabeth.", ""],
  [35, "Fusion Series #3: Hermit, Mothman", "Available 7/09, No Deadline", "Maid Outfit", "Fuse a Mothman with Agilao. You can also use an Agilao skill card to complete this quest.", ""],
  [36, "Defeat a rare Shadow #1", "Available 7/09, No Deadline", "Onyx x7", "You will need to defeat the rare shadow on Yabbashah Block to complete this quest. Since this shadow is resistant to every magic attack, it is recommended that you save your Theurgy for your best chance to defeat it.", ""],
  [37, "Traverse the Monad Passage", "Available 7/09, No Deadline", "Black Sword", "Clear the Monad Door on floor 91 to complete the request.", "Clear the Monad Door on floor 80 and Elizabeth will give you this request."],
  [38, "I want to eat some chilled taiyaki", "Available 7/09, No Deadline", "Nihil Cloth", "Purchase the Iwatodai Forum Note in Club Escapade. After this, you will need to use the Shared Computer to read the note. This will let the school store carry a Lukewarm Taiyaki. Buy it and then put it in your refrigerator in the dorm to chill it. Come back the next day and bring the Chilled Taiyaki to Elizabeth.", "Complete \"Quest 10 - I'd like to try a beef bowl.\""],
  [39, "Let me hear music unique to Gekkokan", "Available 7/09, No Deadline", "Female Uniform (S)", "Check the PA room, right next to your classroom.", ""],
  [40, "I'd like to see a pair of Max Safety Shoes", "Available 7/09, No Deadline", "Twilight Fragment x3", "You can get a pair of Max Safety Shoes through the Shopping TV on July 12th.", ""],
  [41, "Bring me the mysterious person's autograph", "Available 7/09, No Deadline", "Nihil Bible", "If you did the Devil's Social Link, you should have Tanaka's business card which will complete this request.", "Complete \"Quest 40 - I'd like to see a pair of Max Safety Shoes.\""],
  [42, "Please feed the cat", "Available 7/09, No Deadline", "Male Summer Garb", "There is a cat you can find in the Station Outskirt. However, you will need some Super Cat Food and must have fed the cat for four days. The Super Cat Food is sold in the pharmacy shop.", ""],
  [43, "Bring me a christmas star", "Available 7/09, Deadline 8/4", "Jack's Gloves", "Talk to Fuuka during the evening to get a Christmas Star, and bring it to Elizabeth to complete the request.", ""],
  [44, "I wish to feel the ocean", "Available 7/09, Deadline 8/4", "Amethyst x5", "During the Yakushima Vacation, you can pick up four different items on the beach. This option will only appear if you have picked up this quest before the vacation.", ""],
  [45, "Retrieve the fifth old document", "Available 8/08, No Deadline", "50000 Yen", "Get to Yabbashah Block of Tartarus (Floor 118F) and open the purple treasure chest.", "Complete \"Quest 30 - Retrieve the fourth old document\""],
  [46, "Shadow Hunting Milestone #5", "Available 5/10, No Deadline", "Bead Chain x2", "Defeat a total of 600 Shadows.", "Complete \"Quest 31 - Shadow Hunting Milestone #4.\""],
  [47, "Treasure Hunting Milestone #4", "Available 5/10, No Deadline", "Precious Egg x2", "Open a total of 200 treasure chests.", "Complete \"Quest 32 - Treasure Hunting Milestone #3.\""],
  [48, "Persona Fusion Milestone #3", "Available 6/13, No Deadline", "Twilight Fragment x5", "Conduct a total of 50 Persona fusions.", "Complete \"Quest 33 - Persona Fusion Milestone #2.\""],
  [49, "Create a Persona that's level 38 or above", "Available 5/10, No Deadline", "Marionette (Can fuse Nebiros)", "Have a Persona that is level 38 or higher in your possession and report to Elizabeth.", "Complete \"Quest 31 - Shadow Hunting Milestone #4.\""],
  [50, "Perform King and I", "Available 8/08, No Deadline", "Guard Incense II x3", "Carry out the King and I Fusion Spell. To finish this mission, fuse a King Frost and a Black Frost.", "Complete \"Quest 31 - Shadow Hunting Milestone #4.\""],
  [51, "Bring me an Outenta Mitsuyo", "Available 8/08, No Deadline", "Multi-Target Boost (Skill Card)", "Outenta Mitsuyo can be crafted from the Antique Shop, it's one of the starting recipes.", ""],
  [52, "I'd like try a home-cooked meal", "Available 8/08, No Deadline", "Legendary Cleaver", "Cook with someone at the dorm and bring one of those items to Elizabeth to complete this request.", "Complete \"Quest 38 - I want to eat some chilled taiyaki.\""],
  [53, "I'd like see a mysterious potato", "Available 8/08, No Deadline", "Ergotite Shard", "You will need to attempt gardening with someone in the dorm. So that you can get a Tarukaja Potato, bring this to Elizabeth to complete the request.", "Complete \"Quest 52 - I'd like try a home-cooked meal.\""],
  [54, "Attempt a hundred shrine visits", "Available 8/08, No Deadline", "Lime Swim Wear", "Although the quest says a hundred times, you simply just need to check the shrine's altar three times. You will find a 500 yen bill, bring it to Elizabeth to complete the request.", ""],
  [55, "I'd like to see proof of a bond", "Available 8/08, No Deadline", "Space Badge", "Bring an item you can only receive when a Social Link has been maxed.", ""],
  [56, "Look for the drink with my name", "Available 8/08, No Deadline", "As Generic Material", "Have at least high rank charm, and go to the bar Que Sera Sera in Station Outskirts. The bartender will give you a drink called Queen Elizabeth.", ""],
  [57, "I'd like to try Aojiru", "Available 8/08, No Deadline", "Twilight Fragment x8", "Head to the Pharmacy Store to get clues on where to find an Aojiru. Then head to the antique shop and trade 2 Topaz and 1 Turquoise for a Vintage Yagen. Bring it to the Pharmacy to get the drink.", ""],
  [58, "I wish to become a straw millionaire", "Available 8/08, Deadline 8/31", "Turquoise x20", "Elizabeth will give you a wrapped bandage. You will need to trade these bandages for several items to complete the request. Head to the Port Island Station Outskirt to trade the bandages.", ""],
  [59, "Retrieve the sixth old document", "Available 9/10, No Deadline", "70000 Yen", "Get to the top of Yabbashah Block of Tartarus (Floor 144F) and open the purple treasure chest.", "Complete \"Quest 45 - Retrieve the fifth old document.\""],
  [60, "Shadow Hunting Milestone #6", "Available 8/08, No Deadline", "Soma", "Defeat a total of 800 Shadows.", "Complete \"Quest 46 - Shadow Hunting Milestone #5.\""],
  [61, "Create a Persona that's level 46 or above", "Available 9/10, No Deadline", "Atrophying Sutra", "Have a Persona that is level 46 or higher in your possession and report to Elizabeth.", "Complete \"Quest 49 - Create a Persona that's level 38 or above.\""],
  [62, "Fusion Series #4: Lovers, Titania", "Available 9/10, No Deadline", "Male Uniform (S)", "Have the Persona, Titania in your possession with the Skill Matarukja and report to Elizabeth.", "Complete \"Quest 35 - Fusion Series #3: Hermit, Mothman.\""],
  [63, "Fusion Series #5: Magician, Rangda", "Available 9/10, No Deadline", "Female Summer Garb", "Have a Rangda at level 54 or higher in your possession. Rangda is a level 50 Persona that you can fuse, however you should fuse it when you have the Magician Social Link maxed to get enough bonus exp to reach level 54 to instantly complete the quest.", "Complete \"Quest 50 - Perform King and I.\""],
  [64, "Defeat a rare Shadow #2", "Available 9/10, No Deadline", "Topaz x7", "Defeat the rare Shadow in the fourth block, Tziah, and bring back the Sumptuous Coin to Elizabeth.", "Complete \"Quest 49 - Create a Persona that's level 38 or above.\""],
  [65, "Bring me an Ote-gine", "Available 9/10, No Deadline", "Quality Nihil Ore", "Found in the treasure chest in Tartarus floor 143 right after clearing the boss.", ""],
  [66, "Bring me a giant, creepy doll", "Available 9/10, No Deadline", "Quality Nihil Blade", "Check the Laboratory in 1F to get the Creepy Doll and then bring it to Elizabeth.", "Complete \"Quest 39 - Let me hear music unique to Gekkokan.\""],
  [67, "Find me a beautiful tile", "Available 9/10, No Deadline", "Scrub Brush (Weapon for Ken)", "Go to Station Outskirts and head to Mahjong Parlor Red Hawk. You will need maxed courage to go in though. Once you do, give the tile to Elizabeth to complete the quest.", "Complete \"Quest 54 - Attempt a hundred shrine visits.\""],
  [68, "Bring me a fruit knife", "Available 9/10, Deadline 10/2", "Bus Stop Sign (Weapon for Shinji)", "Talk to Shinjiro to get a fruit knife and bring it to Elizabeth to complete the request.", ""],
  [69, "Bring me oil", "Available 9/10, Deadline 10/2", "Rocket Punch (Weapon for Aigis)", "Talk to Aigis to get the machine oil and bring it to Elizabeth.", "Complete \"Quest 65 - Bring me a fruit knife.\""],
  [70, "Retrieve the seventh old document", "Available 10/06, No Deadline", "90000 Yen", "Get to the top of Tziah Block of Tartarus (Floor 172F) and open the purple treasure chest.", "Complete \"Quest 59 - Retrieve the sixth old document\""],
  [71, "Fusion Series #6: Strength, Siegfried", "Available 10/06, No Deadline", "Sky Sundress", "Fuse Siegfried with Endure. The easiest route is to use the Endure skill card reward from Quest 73.", "Complete \"Quest 62 - Fusion Series #4: Lovers, Titania\""],
  [72, "Fusion Series #7: Hierophant, Daisoujou", "Available 10/06, No Deadline", "Blue Shorts", "Fuse Daisoujou with Regenerate 3. A common route is to pass the skill forward from Suzaku via fusion search.", "Complete \"Quest 63 - Fusion Series #5: Magician, Rangda.\""],
  [73, "Bring me a Mikazuki Munechika", "Available 10/06, No Deadline", "Endure", "Craft the weapon at Mayoido Antiques with a Quality Nihil Blade, 3 Emeralds, and 2 Silver Quartz.", ""],
  [74, "I'd like to try sushi", "Available 10/06, No Deadline", "Ergotite Chunk", "Go to Naganaki Shrine and check the Inari shrine. You need rank 4 Academics to receive the sushi.", "Complete \"Quest 53 - I'd like see a mysterious potato.\""],
  [75, "Bring me a Sengoku-era helm", "Available 10/06, No Deadline", "Twilight Fragment x7", "Visit Mr. Ono in the Faculty Office on multiple days until he hands over the helmet.", "Complete \"Quest 66 - Bring me a giant, creepy doll.\""],
  [76, "Bring me a glasses wipe", "Available 10/06, Deadline 11/1", "Garnet x5", "Talk to Shuji Ikutsuki during the evening to get the glasses wipe.", ""],
  [77, "I'd like to walk around Paulownia Mall", "Available 5/10, No Deadline", "Small Cheongsam (Allows you to fuse Hua Po)", "Ask Elizabeth out and choose Paulownia Mall.", "Completed 15 of Elizabeth's requests."],
  [78, "I'd like to visit Iwatodai Station", "Available 5/10, No Deadline", "Book of the Ancients (Allows you to fuse Thoth)", "Ask Elizabeth out and choose Iwatodai Station.", "Completed 30 of Elizabeth's requests."],
  [79, "I'd like to visit Naganaki Shrine", "Available 8/08, No Deadline", "Vitality Sash", "Ask Elizabeth out and choose Naganaki Shrine.", "Completed 45 of Elizabeth's requests."],
  [80, "I'd like to visit Gekkoukan High", "Available 10/06, No Deadline", "Sorcerer's Mark", "Ask Elizabeth out and choose Gekkoukan High.", "Completed 70 of Elizabeth's requests."],
  [81, "I'd like to visit your room", "Available 11/06, No Deadline", "Tyrant's Horn (Allows you to fuse Lucifer)", "Ask Elizabeth out and choose your room.", "Completed 80 of Elizabeth's requests."],
  [82, "Retrieve the last old document", "Available 11/06, No Deadline", "120000 Yen", "Get to Harabah Block of Tartarus (Floor 198F) and open the purple treasure chest.", "Complete \"Quest 70 - Retrieve the seventh old document\""],
  [83, "Retrieve the progress report", "Available 12/04, No Deadline", "150000 Yen", "Get to Adamah Block of Tartarus (Floor 226F) and open the purple treasure chest.", "Complete \"Quest 82 - Retrieve the last old document.\""],
  [84, "Create a Persona with Tempest Slash", "Available 11/06, No Deadline", "Empowering Sutra x3", "The easiest route is to use Chernobog, which starts with Tempest Slash, then report back to Elizabeth.", ""],
  [85, "Create a Persona with Auto-Maraku", "Available 12/04, No Deadline", "Debilitor Sutra x3", "Fuse or prepare a Persona that knows Auto-Maraku. High-level Lovers Personas like Raphael and Cybele are common routes.", "Complete \"Quest 84 - Create a Persona with Tempest Slash\""],
  [86, "Fusion Series #8: Death, Alice", "Available 11/06, No Deadline", "Maid Outfit", "Use the special fusion route for Alice and bring the completed Persona to Elizabeth.", ""],
  [87, "Fusion Series #9: Fool, Loki", "Available 12/07, No Deadline", "Masakados (Lets you fuse Masakados)", "Fuse Loki once you are high enough level. Gabriel + Siegfried or Gabriel + Kali are common routes.", "Complete \"Quest 72 - Fusion Series #7: Hierophant, Daisoujou.\""],
  [88, "Defeat a Greedy Shadow", "Available 11/06, No Deadline", "Life Aid (Skill Card)", "Use the Club Escapade fortune to boost Greedy Shadow spawns, then corner and defeat one in Tartarus.", ""],
  [89, "Bring me a Rai Kunimitsu", "Available 11/06, No Deadline", "Prime Nihil Ore", "Open the locked chest on 184F after clearing the boss floor.", ""],
  [90, "Bring me a Dojigiri Yasutsuna", "Available 12/04, No Deadline", "AS Refined Material", "Open the locked chest on 212F after clearing the boss floor.", ""],
  [91, "Bring me a Tonbo-kiri", "Available 1/02, No Deadline", "Nihil Black Model x2", "Craft the Tonbo-kiri at Mayoido Antiques using a Prime Nihil Blade, 5 Diamonds, and 2 Gold Quartz, then bring it to Elizabeth.", ""],
  [92, "Go clean a restroom", "Available 11/06, No Deadline", "Maid Outfit", "Go to the Port Island Station restroom above the movie theater and interact with it.", ""],
  [93, "Go water the flowers", "Available 11/06, No Deadline", "Maid Outfit", "Go to the school rooftop and water the flower bed.", ""],
  [94, "Bring me food for a Furry Friend", "Available 11/06, Deadline 11/30", "Bone (Weapon for Koromaru)", "Talk to Koromaru to get the Gourmet Dog Food and bring it to Elizabeth.", ""],
  [95, "Bring me a Featherman R action figure", "Available 11/06, Deadline 11/30", "Sacrificial Idol", "Talk to Ken to get the Featherman R figure and bring it to Elizabeth.", "Complete \"Quest 94 - Bring me food for a Furry Friend\""],
  [96, "I'd like to try Oden Juice", "Available 11/06, No Deadline", "Winter Uniform", "During the Kyoto trip, buy the local drink from the vending machine and trade it back to the Friendly Student near the Persimmon Tree for Oden Juice.", ""],
  [97, "Bring me my christmas present", "Available 12/04, Deadline 12/25", "Ruby x3", "If you have rescued missing people earlier in the run, talk to the Eccentric Man on Paulownia Mall 2F to get the present Elizabeth wants.", ""],
  [98, "Fusion Series #10: Tower, Masakado", "1/6, No Deadline", "Nihil White Model x2", "Fuse Masakado with Charge by passing it forward through Koumokuten before assembling the four-guardian special fusion.", ""],
  [99, "Defeat the Shadow of the Void", "1/6, No Deadline", "Nihil White Model x2", "Clear the final Monad Passage on 255F and beat Shadow of the Void. Save burst damage for after its Diarahan reset.", ""],
  [100, "Bring me a Bloody Button", "1/2, No Deadline", "Divine Pillar Accessory (User can no longer dodge attacks, but reduces all damage taken to 50%.)", "Defeat the Reaper and bring Elizabeth the Bloody Button. Bring Salvation, Debilitate, and cover party weaknesses with nullifying accessories where possible.", ""],
  [101, "Take out the ultimate adversary", "1/6, No Deadline", "Omnipotent Orb", "Defeat the ultimate adversary.", ""],
];

const REQUEST_CATEGORY_LABELS = {
  town: 'Town / outing',
  tartarus: 'Tartarus',
  milestone: 'Milestone',
  velvet: 'Velvet Room',
  boss: 'Boss challenge',
  item: 'Item / errand'
};

const REQUEST_SYSTEM_LABELS = {
  town: 'Town',
  tartarus: 'Tartarus',
  velvet: 'Velvet Room',
  general: 'General'
};

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeDateText(dateText) {
  const normalized = String(dateText || '').replace(/\s+/g, ' ').trim();
  const availableMatch = normalized.match(/Available\s+(\d{1,2}\/\d{1,2})/i);
  const deadlineMatch = normalized.match(/Deadline\s+(\d{1,2}\/\d{1,2})/i);
  const directDateMatch = normalized.match(/^(\d{1,2}\/\d{1,2})/);
  return {
    raw: normalized,
    available: availableMatch ? availableMatch[1] : directDateMatch ? directDateMatch[1] : null,
    deadline: deadlineMatch ? deadlineMatch[1] : null
  };
}

function deriveFloor(solution) {
  const exactFloorMatch = solution.match(/(?:Floor|floor)\s+(\d{1,3})/);
  if (exactFloorMatch) {
    return Number(exactFloorMatch[1]);
  }
  const floorSuffixMatch = solution.match(/\b(\d{1,3})F\b/);
  if (floorSuffixMatch) {
    return Number(floorSuffixMatch[1]);
  }
  return null;
}

function deriveBlock(solution) {
  const blockMatch = solution.match(/\b(Thebel|Arqa|Yabbashah|Tziah|Harabah|Adamah)\b/i);
  return blockMatch ? blockMatch[1].toLowerCase() : null;
}

function deriveVelvetTarget(title) {
  const fusionMatch = title.match(/Fusion Series #\d+:?\s*[^,]+,\s*(.+)$/i);
  if (fusionMatch) {
    return fusionMatch[1].trim();
  }
  return null;
}

function deriveSkillTarget(title) {
  const skillMatch = title.match(/^Create a Persona with (.+)$/i);
  if (!skillMatch) {
    return null;
  }
  const skill = skillMatch[1].trim();
  return {
    'Auto-Maraku': 'Auto Maraku'
  }[skill] || skill;
}

function deriveCategory(title, solution) {
  const lowerTitle = title.toLowerCase();
  const lowerSolution = solution.toLowerCase();
  if (lowerTitle.startsWith('fusion series') || lowerTitle.startsWith('create a persona') || lowerTitle.includes('persona fusion milestone') || lowerTitle.startsWith('perform king and i')) {
    return 'velvet';
  }
  if (lowerTitle.includes('shadow hunting') || lowerTitle.includes('treasure hunting')) {
    return 'milestone';
  }
  if (lowerTitle.includes('shadow of the void') || lowerTitle.includes('ultimate adversary') || lowerTitle.includes('bloody button') || lowerTitle.includes('defeat a rare shadow') || lowerTitle.includes('defeat a greedy shadow')) {
    return 'boss';
  }
  if (
    lowerTitle.startsWith("i'd like") ||
    lowerTitle.startsWith('take me') ||
    lowerTitle.startsWith('please let me') ||
    lowerTitle.startsWith('i want') ||
    lowerTitle.startsWith('please prevail') ||
    lowerTitle.startsWith('experiment with') ||
    lowerTitle.startsWith('go ') ||
    lowerTitle.startsWith('attempt ') ||
    lowerTitle.startsWith('let me ')
  ) {
    return 'town';
  }
  if (
    lowerTitle.includes('old document') ||
    lowerTitle.includes('progress report') ||
    lowerSolution.includes('tartarus') ||
    /\bfloor\s+\d{1,3}\b/i.test(solution) ||
    /\b\d{1,3}f\b/i.test(solution) ||
    lowerSolution.includes('reaper') ||
    lowerSolution.includes('monad passage') ||
    lowerSolution.includes('boss floor')
  ) {
    return 'tartarus';
  }
  return 'item';
}

function deriveSystem(category) {
  if (category === 'velvet') {
    return 'velvet';
  }
  if (category === 'tartarus' || category === 'milestone' || category === 'boss') {
    return 'tartarus';
  }
  if (category === 'town') {
    return 'town';
  }
  return 'general';
}

const ELIZABETH_REQUESTS = ELIZABETH_REQUEST_ROWS.map(([number, title, dateText, reward, solution, prerequisite]) => {
  const dateInfo = normalizeDateText(dateText);
  const category = deriveCategory(title, solution);
  const system = deriveSystem(category);
  const floor = deriveFloor(solution);
  const block = deriveBlock(solution);
  const targetPersona = deriveVelvetTarget(title);
  const targetSkill = deriveSkillTarget(title);

  return {
    id: `elizabeth-request-${String(number).padStart(3, '0')}`,
    number,
    title,
    available: dateInfo.available,
    deadline: dateInfo.deadline,
    reward,
    solution,
    prerequisite: prerequisite || null,
    category,
    categoryLabel: REQUEST_CATEGORY_LABELS[category],
    system,
    systemLabel: REQUEST_SYSTEM_LABELS[system],
    floor,
    block,
    targetPersona,
    targetSkill,
    isFusionSeries: title.startsWith('Fusion Series'),
    sortLabel: `${String(number).padStart(3, '0')} ${slugify(title)}`
  };
}).sort((left, right) => left.number - right.number);

window.ELIZABETH_REQUESTS = ELIZABETH_REQUESTS;
window.ELIZABETH_REQUEST_CATEGORY_LABELS = REQUEST_CATEGORY_LABELS;
})();
