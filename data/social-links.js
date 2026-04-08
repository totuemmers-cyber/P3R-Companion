// P3R Companion — Social Link Data

const SOCIAL_STATS = {
  academics: ["Slacker","Below Average","Average","Above Average","Smart","Genius"],
  charm:     ["Plain","Unpolished","Smooth","Persuasive","Popular","Charismatic"],
  courage:   ["Timid","Ordinary","Determined","Tough","Brave","Badass"]
};

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_IN_MONTH = [0,31,28,31,30,31,30,31,31,30,31,30,31];

// Dates when free time is restricted (exams, full moon ops, story events)
const BLOCKED_DATES = [
  // Midterm exams
  {from:{month:5,day:18},to:{month:5,day:23},reason:"Midterm Exams",block:"both"},
  // Final exams
  {from:{month:7,day:14},to:{month:7,day:17},reason:"Final Exams",block:"both"},
  // Midterm exams
  {from:{month:10,day:13},to:{month:10,day:16},reason:"Midterm Exams",block:"both"},
  // Final exams
  {from:{month:12,day:14},to:{month:12,day:18},reason:"Final Exams",block:"both"},
  // Full moon operations (evening blocked)
  {from:{month:5,day:9},to:{month:5,day:9},reason:"Full Moon Operation",block:"evening"},
  {from:{month:6,day:8},to:{month:6,day:8},reason:"Full Moon Operation",block:"evening"},
  {from:{month:7,day:7},to:{month:7,day:7},reason:"Full Moon Operation",block:"evening"},
  {from:{month:8,day:6},to:{month:8,day:6},reason:"Full Moon Operation",block:"evening"},
  {from:{month:9,day:5},to:{month:9,day:5},reason:"Full Moon Operation",block:"evening"},
  {from:{month:10,day:4},to:{month:10,day:4},reason:"Full Moon Operation",block:"evening"},
  {from:{month:11,day:3},to:{month:11,day:3},reason:"Full Moon Operation",block:"evening"},
  {from:{month:12,day:2},to:{month:12,day:2},reason:"Full Moon Operation",block:"evening"},
  {from:{month:12,day:31},to:{month:12,day:31},reason:"Full Moon Operation",block:"both"},
  {from:{month:1,day:31},to:{month:1,day:31},reason:"Nyx Battle",block:"both"},
  // Summer break (school links unavailable, but some are still accessible)
  // Not blocking these since links relocate during break
];

const SOCIAL_LINKS = {
  "Fool": {
    character: "SEES",
    arcana: "Fool",
    description: "Your bond with the Specialized Extracurricular Execution Squad grows as you explore Tartarus together.",
    automatic: true,
    availableDays: [],
    timeSlot: null,
    unlockDate: {month:4,day:7},
    endDate: null,
    location: "Iwatodai Dorm",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Automatic — April 20 (first Tartarus visit)"},
      {rank:2,points:0,note:"Automatic — story progression"},
      {rank:3,points:0,note:"Automatic — story progression"},
      {rank:4,points:0,note:"Automatic — story progression"},
      {rank:5,points:0,note:"Automatic — story progression"},
      {rank:6,points:0,note:"Automatic — story progression"},
      {rank:7,points:0,note:"Automatic — story progression"},
      {rank:8,points:0,note:"Automatic — story progression"},
      {rank:9,points:0,note:"Automatic — story progression"},
      {rank:10,points:0,note:"Automatic — story progression"}
    ]
  },
  "Magician": {
    character: "Kenji Tomochika",
    arcana: "Magician",
    description: "A classmate who dreams of dating his teacher. Enthusiastic but misguided.",
    automatic: false,
    availableDays: [1,2,3,4,5,6], // Mon-Sat
    timeSlot: "day",
    unlockDate: {month:4,day:22},
    endDate: null,
    location: "Classroom 2F, Gekkoukan",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Talk to Kenji in classroom"},
      {rank:2,points:0,answers:[
        {prompt:"Kenji is talking about his dream girl.",options:[
          {text:"She sounds great.",points:3},
          {text:"A teacher, really?",points:2},
          {text:"That's weird.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He asks how you feel about older women.",options:[
          {text:"I'm all for it.",points:3},
          {text:"Age doesn't matter.",points:3},
          {text:"I don't get it.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Kenji asks for advice on a gift.",options:[
          {text:"Get her flowers.",points:2},
          {text:"Write her a letter.",points:3},
          {text:"Give up.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"He's worried people are talking about them.",options:[
          {text:"Just ignore them.",points:3},
          {text:"Maybe they have a point.",points:0},
          {text:"That sounds rough.",points:2}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Kenji talks about getting serious.",options:[
          {text:"You should go for it.",points:3},
          {text:"Think it over carefully.",points:2},
          {text:"That's a bad idea.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"He mentions wanting to elope after graduation.",options:[
          {text:"That's bold!",points:3},
          {text:"Are you sure about that?",points:2},
          {text:"You're delusional.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Kenji is upset — things aren't going well.",options:[
          {text:"What happened?",points:3},
          {text:"I told you so.",points:0},
          {text:"Hang in there.",points:2}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"He found out the truth about his teacher.",options:[
          {text:"Are you okay?",points:3},
          {text:"I'm sorry.",points:3},
          {text:"You'll get over it.",points:0}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Priestess": {
    character: "Fuuka Yamagishi",
    arcana: "Priestess",
    description: "A shy SEES member with incredible navigation abilities. Loves cooking despite her lack of talent.",
    automatic: false,
    availableDays: [1,2,3,4,5,6],
    timeSlot: "day",
    unlockDate: {month:6,day:19},
    endDate: null,
    location: "Classroom 2F, Gekkoukan",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Talk to Fuuka after she joins SEES"},
      {rank:2,points:0,answers:[
        {prompt:"Fuuka wants to try cooking for you.",options:[
          {text:"I'd love that.",points:3},
          {text:"Are you any good?",points:2},
          {text:"I'll pass.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She asks if her cooking has improved.",options:[
          {text:"It's getting better!",points:3},
          {text:"It's... unique.",points:2},
          {text:"Not really.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Fuuka is worried she's not useful to the team.",options:[
          {text:"You're essential to us.",points:3},
          {text:"Everyone has a role.",points:2},
          {text:"Maybe train more.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"She talks about wanting to find her own strength.",options:[
          {text:"You've already found it.",points:3},
          {text:"I'll help you.",points:3},
          {text:"Good luck.",points:1}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Fuuka made lunch for you.",options:[
          {text:"Thank you, Fuuka.",points:3},
          {text:"You didn't have to.",points:2},
          {text:"Is it safe to eat?",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"She confides that she used to be bullied.",options:[
          {text:"That must have been hard.",points:3},
          {text:"You're strong now.",points:3},
          {text:"Why are you telling me?",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Fuuka asks what you think of her.",options:[
          {text:"You're amazing.",points:3},
          {text:"You're a great friend.",points:2},
          {text:"I don't know.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"She wants to become someone who protects others.",options:[
          {text:"You already do.",points:3},
          {text:"That's admirable.",points:2},
          {text:"Don't overdo it.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Empress": {
    character: "Mitsuru Kirijo",
    arcana: "Empress",
    description: "Heiress of the Kirijo Group and leader of SEES. Brilliant, elegant, and burdened by her family's legacy.",
    automatic: false,
    availableDays: [2,4,6], // Tue, Thu, Sat
    timeSlot: "day",
    unlockDate: {month:11,day:21},
    endDate: null,
    location: "Faculty Office Hallway 1F",
    statRequirements: {academics:6},
    ranks: [
      {rank:1,points:0,note:"Requires Genius Academics. Talk to Mitsuru after Nov 21."},
      {rank:2,points:0,answers:[
        {prompt:"Mitsuru is studying motorcycle catalogs.",options:[
          {text:"That's cool.",points:3},
          {text:"I didn't expect that.",points:2},
          {text:"Isn't that dangerous?",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She talks about her responsibilities as heiress.",options:[
          {text:"That's a heavy burden.",points:3},
          {text:"You seem capable.",points:2},
          {text:"Must be nice being rich.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Mitsuru asks if you understand what duty means.",options:[
          {text:"Doing what's right.",points:3},
          {text:"Protecting people.",points:3},
          {text:"Sounds exhausting.",points:0}
        ]}
      ]},
      {rank:5,points:22,answers:[
        {prompt:"She mentions her father's expectations.",options:[
          {text:"What do you want?",points:3},
          {text:"He must be proud of you.",points:2},
          {text:"Just do your best.",points:1}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Mitsuru is frustrated with a family dispute.",options:[
          {text:"Tell me about it.",points:3},
          {text:"Can I help?",points:3},
          {text:"That's your problem.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"She reveals her doubts about leading SEES.",options:[
          {text:"You're a great leader.",points:3},
          {text:"Everyone has doubts.",points:2},
          {text:"Maybe step down then.",points:0}
        ]}
      ]},
      {rank:8,points:30,answers:[
        {prompt:"Mitsuru opens up about losing someone important.",options:[
          {text:"I'm here for you.",points:3},
          {text:"You don't have to be strong all the time.",points:3},
          {text:"Time heals all wounds.",points:1}
        ]}
      ]},
      {rank:9,points:30,answers:[
        {prompt:"She's decided to forge her own path.",options:[
          {text:"I believe in you.",points:3},
          {text:"That takes courage.",points:2},
          {text:"Good luck.",points:1}
        ]}
      ]},
      {rank:10,points:30,note:"Rank up is automatic after the event."}
    ]
  },
  "Emperor": {
    character: "Hidetoshi Odagiri",
    arcana: "Emperor",
    description: "A strict disciplinarian on the Student Council. Values order above all else.",
    automatic: false,
    availableDays: [1,2,3,4,5], // Mon-Fri
    timeSlot: "day",
    unlockDate: {month:4,day:27},
    endDate: null,
    location: "Student Council Room 2F",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Join Student Council"},
      {rank:2,points:0,answers:[
        {prompt:"Hidetoshi is enforcing school rules strictly.",options:[
          {text:"Rules are important.",points:3},
          {text:"Don't overdo it.",points:2},
          {text:"Lighten up.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He caught a student smoking.",options:[
          {text:"They should be punished.",points:3},
          {text:"Give them a warning.",points:2},
          {text:"It's not a big deal.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Hidetoshi asks if order or freedom matters more.",options:[
          {text:"Order keeps things fair.",points:3},
          {text:"Both are important.",points:2},
          {text:"Freedom, obviously.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"Other students are complaining about him.",options:[
          {text:"They don't understand you.",points:3},
          {text:"Maybe listen to them.",points:2},
          {text:"They have a point.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"He's determined to find the culprit behind a prank.",options:[
          {text:"I'll help you.",points:3},
          {text:"Be careful.",points:2},
          {text:"Just let it go.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Hidetoshi questions if he's been too harsh.",options:[
          {text:"You're doing what's right.",points:3},
          {text:"Maybe a little.",points:2},
          {text:"Definitely.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"He wants to be a leader people respect, not fear.",options:[
          {text:"I already respect you.",points:3},
          {text:"That's a good goal.",points:2},
          {text:"Good luck with that.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"He thanks you for sticking by him.",options:[
          {text:"That's what friends do.",points:3},
          {text:"Of course.",points:3},
          {text:"Don't mention it.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Hierophant": {
    character: "Bunkichi & Mitsuko",
    arcana: "Hierophant",
    description: "An elderly couple who run the Bookworms used bookstore. Grieving their late son, a former Gekkoukan teacher.",
    automatic: false,
    availableDays: [1,2,3,4,5,6],
    timeSlot: "day",
    unlockDate: {month:4,day:25},
    endDate: null,
    location: "Bookworms, Iwatodai Strip Mall",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Visit the bookstore"},
      {rank:2,points:0,answers:[
        {prompt:"Bunkichi talks about his persimmon tree.",options:[
          {text:"It sounds beautiful.",points:3},
          {text:"Tell me more.",points:3},
          {text:"It's just a tree.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"They mention their son used to be a teacher.",options:[
          {text:"He sounds wonderful.",points:3},
          {text:"You must be proud.",points:3},
          {text:"I see.",points:1}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Bunkichi worries the tree may be cut down.",options:[
          {text:"We should protect it.",points:3},
          {text:"That's terrible.",points:2},
          {text:"Trees get cut sometimes.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"They reminisce about their son's kindness.",options:[
          {text:"He raised good people.",points:3},
          {text:"I wish I'd met him.",points:3},
          {text:"That's in the past.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"The tree is scheduled for removal.",options:[
          {text:"There must be something we can do.",points:3},
          {text:"I'll help save it.",points:3},
          {text:"That's too bad.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Mitsuko is getting emotional about the tree.",options:[
          {text:"It'll be okay.",points:3},
          {text:"We won't let it happen.",points:2},
          {text:"Try to stay calm.",points:1}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Students are signing a petition to save the tree.",options:[
          {text:"That's great news!",points:3},
          {text:"People do care.",points:2},
          {text:"Will it work?",points:1}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"They're grateful for everything you've done.",options:[
          {text:"I'm glad I could help.",points:3},
          {text:"You're like family to me.",points:3},
          {text:"No problem.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Lovers": {
    character: "Yukari Takeba",
    arcana: "Lovers",
    description: "A popular SEES member grappling with the truth behind her father's death and the Kirijo Group.",
    automatic: false,
    availableDays: [1,3,5,6], // Mon, Wed, Fri, Sat
    timeSlot: "day",
    unlockDate: {month:7,day:25},
    endDate: null,
    location: "Classroom 2F, Gekkoukan",
    statRequirements: {charm:6},
    ranks: [
      {rank:1,points:0,note:"Requires Charismatic Charm. Talk to Yukari after July 25."},
      {rank:2,points:0,answers:[
        {prompt:"Yukari talks about archery practice.",options:[
          {text:"You must be talented.",points:3},
          {text:"Sounds tough.",points:2},
          {text:"Why archery?",points:1}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She mentions her complicated family.",options:[
          {text:"I'll listen if you want to talk.",points:3},
          {text:"Family is important.",points:2},
          {text:"Everyone has problems.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Yukari questions the Kirijo Group's motives.",options:[
          {text:"You have a right to know.",points:3},
          {text:"Maybe it's best not to dig.",points:0},
          {text:"I wonder too.",points:2}
        ]}
      ]},
      {rank:5,points:22,answers:[
        {prompt:"She talks about her father's sacrifice.",options:[
          {text:"He was a hero.",points:3},
          {text:"I'm sorry.",points:2},
          {text:"That was his choice.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Yukari is angry about the truth she uncovered.",options:[
          {text:"Your anger is justified.",points:3},
          {text:"Try to stay calm.",points:1},
          {text:"What will you do now?",points:2}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"She asks if you think she's strong.",options:[
          {text:"You're one of the strongest people I know.",points:3},
          {text:"Strength isn't just physical.",points:2},
          {text:"You could be stronger.",points:0}
        ]}
      ]},
      {rank:8,points:30,answers:[
        {prompt:"Yukari opens up about her feelings.",options:[
          {text:"I feel the same way.",points:3},
          {text:"You're important to me.",points:3},
          {text:"Let's stay friends.",points:1}
        ]}
      ]},
      {rank:9,points:30,answers:[
        {prompt:"She's found peace with her past.",options:[
          {text:"I'm proud of you.",points:3},
          {text:"You've grown so much.",points:3},
          {text:"Good for you.",points:1}
        ]}
      ]},
      {rank:10,points:30,note:"Rank up is automatic after the event."}
    ]
  },
  "Chariot": {
    character: "Kazushi Miyamoto",
    arcana: "Chariot",
    description: "An athletic classmate pushing himself to the limit in sports despite a serious knee injury.",
    automatic: false,
    availableDays: [1,2,3,4,5], // Mon-Fri (sports club days)
    timeSlot: "day",
    unlockDate: {month:4,day:23},
    endDate: null,
    location: "Gymnasium, Gekkoukan",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Join a sports club (Kendo, Swim, or Track)"},
      {rank:2,points:0,answers:[
        {prompt:"Kazushi is pumped about the tournament.",options:[
          {text:"Let's win this!",points:3},
          {text:"Don't overdo it.",points:2},
          {text:"Whatever.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He's pushing through pain in his knee.",options:[
          {text:"You should rest.",points:2},
          {text:"I admire your dedication.",points:3},
          {text:"That's reckless.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Kazushi talks about his rivalry with Mamoru.",options:[
          {text:"You can beat him.",points:3},
          {text:"He's tough competition.",points:2},
          {text:"You don't stand a chance.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"His knee is getting worse.",options:[
          {text:"Please see a doctor.",points:3},
          {text:"You need to take care of yourself.",points:3},
          {text:"Just push through it.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"He's hiding his injury from the coach.",options:[
          {text:"That's your call.",points:2},
          {text:"You should tell them.",points:3},
          {text:"Smart move.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Kazushi is questioning if it's all worth it.",options:[
          {text:"Your health matters more.",points:3},
          {text:"Only you can decide.",points:2},
          {text:"Just quit then.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"His little nephew looks up to him.",options:[
          {text:"Be the role model he needs.",points:3},
          {text:"That's sweet.",points:2},
          {text:"Kids are gullible.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"He's decided what to do about his future.",options:[
          {text:"I support your decision.",points:3},
          {text:"That took courage.",points:3},
          {text:"Are you sure?",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Justice": {
    character: "Chihiro Fushimi",
    arcana: "Justice",
    description: "The timid Student Council treasurer struggling with her shyness and an androphobia she wants to overcome.",
    automatic: false,
    availableDays: [2,4,6], // Tue, Thu, Sat
    timeSlot: "day",
    unlockDate: {month:5,day:7},
    endDate: null,
    location: "Student Council Room 2F",
    statRequirements: {academics:2},
    ranks: [
      {rank:1,points:0,note:"Talk to Chihiro after joining Student Council"},
      {rank:2,points:0,answers:[
        {prompt:"Chihiro is nervous around you.",options:[
          {text:"Take your time.",points:3},
          {text:"Don't be nervous.",points:2},
          {text:"What's wrong with you?",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She dropped a stack of papers.",options:[
          {text:"Let me help.",points:3},
          {text:"Are you okay?",points:2},
          {text:"You're so clumsy.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Chihiro explains her fear of men.",options:[
          {text:"I understand.",points:3},
          {text:"That must be difficult.",points:3},
          {text:"That's irrational.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"She wants to overcome her phobia.",options:[
          {text:"I'll help you.",points:3},
          {text:"You can do it.",points:2},
          {text:"Why bother?",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"She went to a bookstore by herself.",options:[
          {text:"That's great progress!",points:3},
          {text:"I'm proud of you.",points:3},
          {text:"That's not a big deal.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Someone was rude to her and she froze.",options:[
          {text:"It's not your fault.",points:3},
          {text:"You'll do better next time.",points:2},
          {text:"You need thicker skin.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Chihiro stood up for herself for the first time.",options:[
          {text:"That's incredible!",points:3},
          {text:"You've changed so much.",points:3},
          {text:"It's about time.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"She thanks you for helping her change.",options:[
          {text:"You did it yourself.",points:3},
          {text:"I'm glad I could help.",points:2},
          {text:"No big deal.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Hermit": {
    character: "Maya (Y-ko)",
    arcana: "Hermit",
    description: "A mysterious online friend in the MMO Innocent Sin Online. Her cheerful avatar hides a deeper story.",
    automatic: false,
    availableDays: [0,1,2,3,4,5,6], // Any day
    timeSlot: "evening",
    unlockDate: {month:4,day:29},
    endDate: {month:11,day:2},
    location: "Dorm — PC in your room",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Log into the MMO on the dorm PC"},
      {rank:2,points:0,answers:[
        {prompt:"Maya is excited to see you online.",options:[
          {text:"I'm happy to see you too!",points:3},
          {text:"Hey, Maya.",points:2},
          {text:"I was bored.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She asks why you play the game.",options:[
          {text:"To talk to you.",points:3},
          {text:"It's fun.",points:2},
          {text:"To kill time.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Maya hints that real life is hard for her.",options:[
          {text:"Want to talk about it?",points:3},
          {text:"The game is our escape.",points:2},
          {text:"Everyone has problems.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"She talks about being alone in real life.",options:[
          {text:"You're not alone — you have me.",points:3},
          {text:"That sounds lonely.",points:2},
          {text:"Make friends offline.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Maya admits the game is her only connection.",options:[
          {text:"Our friendship is real.",points:3},
          {text:"I value our talks.",points:3},
          {text:"It's just a game.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"She's thinking of quitting the game.",options:[
          {text:"I'd miss you.",points:3},
          {text:"Do what's best for you.",points:2},
          {text:"Okay.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Maya reveals something personal about herself.",options:[
          {text:"Thank you for trusting me.",points:3},
          {text:"I'm glad you told me.",points:3},
          {text:"Why tell me?",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"She says she's found courage because of you.",options:[
          {text:"You gave me courage too.",points:3},
          {text:"I'm rooting for you.",points:2},
          {text:"Good for you.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Fortune": {
    character: "Keisuke Hiraga",
    arcana: "Fortune",
    description: "A talented art club member torn between his passion and his father's wish for him to become a doctor.",
    automatic: false,
    availableDays: [1,2,3,4,5], // Mon-Fri
    timeSlot: "day",
    unlockDate: {month:4,day:23},
    endDate: null,
    location: "Art Club / Photo Club Room",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Join Art Club or Photography Club"},
      {rank:2,points:0,answers:[
        {prompt:"Keisuke is passionate about his art.",options:[
          {text:"Your work is great.",points:3},
          {text:"You really love this.",points:2},
          {text:"It's just a hobby.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"His father wants him to be a doctor.",options:[
          {text:"What do you want?",points:3},
          {text:"Doctors help people too.",points:2},
          {text:"Listen to your dad.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"He's torn between art and medicine.",options:[
          {text:"Follow your heart.",points:3},
          {text:"It's a tough choice.",points:2},
          {text:"Money is important.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"Keisuke got into a fight with his dad.",options:[
          {text:"Are you okay?",points:3},
          {text:"He'll come around.",points:2},
          {text:"You shouldn't fight.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"A classmate mocked his art.",options:[
          {text:"Don't listen to them.",points:3},
          {text:"Your art has value.",points:3},
          {text:"Maybe they're right.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"He's questioning if art can really be a career.",options:[
          {text:"If anyone can, it's you.",points:3},
          {text:"It won't be easy.",points:2},
          {text:"Probably not.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"His dad got sick.",options:[
          {text:"Is he okay?",points:3},
          {text:"That must be scary.",points:2},
          {text:"That's unfortunate.",points:1}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"Keisuke has made a decision about his future.",options:[
          {text:"I support you.",points:3},
          {text:"That's brave.",points:2},
          {text:"Are you sure?",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Strength": {
    character: "Yuko Nishiwaki",
    arcana: "Strength",
    description: "The team manager for the sports clubs. A caring and reliable upperclassman considering a career in coaching.",
    automatic: false,
    availableDays: [1,3,5], // Mon, Wed, Fri
    timeSlot: "day",
    unlockDate: {month:4,day:23},
    endDate: null,
    location: "Gymnasium, Gekkoukan",
    statRequirements: {charm:2},
    ranks: [
      {rank:1,points:0,note:"Requires Unpolished Charm. Talk to Yuko after joining a sports club."},
      {rank:2,points:0,answers:[
        {prompt:"Yuko talks about being team manager.",options:[
          {text:"The team is lucky to have you.",points:3},
          {text:"Sounds like hard work.",points:2},
          {text:"That's boring.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She's thinking about what career to pursue.",options:[
          {text:"What are you passionate about?",points:3},
          {text:"Take your time deciding.",points:2},
          {text:"It doesn't matter.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Yuko mentions wanting to help kids through sports.",options:[
          {text:"You'd be great at that.",points:3},
          {text:"That's a noble goal.",points:2},
          {text:"Is there money in that?",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"She's volunteering at an elementary school.",options:[
          {text:"That's wonderful.",points:3},
          {text:"How's it going?",points:2},
          {text:"Sounds tiring.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"A kid at the school is having trouble.",options:[
          {text:"You can reach them.",points:3},
          {text:"Kids need patience.",points:2},
          {text:"Not your problem.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"She's doubting if she can make a difference.",options:[
          {text:"You already have.",points:3},
          {text:"Believe in yourself.",points:2},
          {text:"Maybe you can't.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"The kid finally opened up to her.",options:[
          {text:"You did it!",points:3},
          {text:"See? You're a natural.",points:3},
          {text:"Congratulations.",points:1}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"Yuko has decided on her dream career.",options:[
          {text:"I know you'll succeed.",points:3},
          {text:"I'm happy for you.",points:2},
          {text:"Okay.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Hanged": {
    character: "Maiko Oohashi",
    arcana: "Hanged Man",
    description: "A lonely little girl at the shrine whose parents are going through a bitter divorce.",
    automatic: false,
    availableDays: [1,3,6], // Mon, Wed, Sat
    timeSlot: "day",
    unlockDate: {month:5,day:6},
    endDate: null,
    location: "Naganaki Shrine",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Talk to Maiko at the shrine playground"},
      {rank:2,points:0,answers:[
        {prompt:"Maiko wants to play at the shrine.",options:[
          {text:"Sure, let's play!",points:3},
          {text:"For a little while.",points:2},
          {text:"I'm busy.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"She mentions her parents fighting.",options:[
          {text:"That sounds scary.",points:3},
          {text:"I'm sorry to hear that.",points:3},
          {text:"All parents fight.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Maiko asks if you'll always be her friend.",options:[
          {text:"Of course I will.",points:3},
          {text:"We're friends, aren't we?",points:3},
          {text:"I guess.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"She's worried her parents might get divorced.",options:[
          {text:"It'll be okay.",points:3},
          {text:"I'm here for you.",points:3},
          {text:"That might happen.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Maiko ran away from home.",options:[
          {text:"Are you okay?!",points:3},
          {text:"Your parents must be worried.",points:2},
          {text:"You shouldn't do that.",points:1}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"She's blaming herself for her parents' problems.",options:[
          {text:"It's not your fault.",points:3},
          {text:"They both love you.",points:3},
          {text:"Maybe you're right.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Her parents are getting divorced for real.",options:[
          {text:"I'm so sorry, Maiko.",points:3},
          {text:"You'll get through this.",points:2},
          {text:"I expected this.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"She's choosing which parent to live with.",options:[
          {text:"Choose what feels right.",points:3},
          {text:"That's a hard choice.",points:2},
          {text:"Just pick one.",points:0}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Death": {
    character: "Pharos",
    arcana: "Death",
    description: "A mysterious boy who visits you in your room at midnight. Speaks of the coming of the end.",
    automatic: true,
    availableDays: [],
    timeSlot: null,
    unlockDate: {month:6,day:12},
    endDate: null,
    location: "Dorm — your room (midnight)",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Automatic — June 12"},
      {rank:2,points:0,note:"Automatic — story progression"},
      {rank:3,points:0,note:"Automatic — story progression"},
      {rank:4,points:0,note:"Automatic — story progression"},
      {rank:5,points:0,note:"Automatic — story progression"},
      {rank:6,points:0,note:"Automatic — story progression"},
      {rank:7,points:0,note:"Automatic — story progression"},
      {rank:8,points:0,note:"Automatic — story progression"},
      {rank:9,points:0,note:"Automatic — story progression"},
      {rank:10,points:0,note:"Automatic — story progression"}
    ]
  },
  "Temperance": {
    character: "Bebe (Andre Laurent Jean Geraux)",
    arcana: "Temperance",
    description: "A French exchange student obsessed with Japanese culture, especially traditional fashion design.",
    automatic: false,
    availableDays: [2,3,5], // Tue, Wed, Fri
    timeSlot: "day",
    unlockDate: {month:4,day:27},
    endDate: null,
    location: "Home Economics Room 1F",
    statRequirements: {academics:2},
    ranks: [
      {rank:1,points:0,note:"Talk to Bebe in the Home Economics room"},
      {rank:2,points:0,answers:[
        {prompt:"Bebe is excited about Japanese fashion.",options:[
          {text:"Your passion is inspiring.",points:3},
          {text:"Tell me about it.",points:2},
          {text:"That's weird.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He's making a kimono and wants your opinion.",options:[
          {text:"It looks amazing!",points:3},
          {text:"You're talented.",points:2},
          {text:"I don't get fashion.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Bebe talks about why he came to Japan.",options:[
          {text:"Japan is lucky to have you.",points:3},
          {text:"Following your dreams is brave.",points:3},
          {text:"Must be nice to travel.",points:1}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"His uncle wants him to come back home.",options:[
          {text:"Do you want to go back?",points:3},
          {text:"That's tough.",points:2},
          {text:"Just go back then.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"He's worried his time in Japan is limited.",options:[
          {text:"We'll make the most of it.",points:3},
          {text:"I hope you can stay.",points:2},
          {text:"That's life.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Bebe is working hard to finish his kimono.",options:[
          {text:"I believe in you.",points:3},
          {text:"Don't push too hard.",points:2},
          {text:"Is it worth all this?",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"He reveals the kimono is for someone special.",options:[
          {text:"That's so thoughtful.",points:3},
          {text:"Who is it for?",points:2},
          {text:"Whatever.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"Bebe has finished the kimono and is at peace.",options:[
          {text:"It's beautiful.",points:3},
          {text:"You should be proud.",points:3},
          {text:"Not bad.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Devil": {
    character: "President Tanaka",
    arcana: "Devil",
    description: "A shady TV shopping host who ropes you into his schemes. Materialistic but surprisingly complex.",
    automatic: false,
    availableDays: [2,6], // Tue, Sat
    timeSlot: "evening",
    unlockDate: {month:6,day:16},
    endDate: null,
    location: "Paulownia Mall",
    statRequirements: {charm:3},
    ranks: [
      {rank:1,points:0,note:"Requires Smooth Charm. Respond to Tanaka's TV ad, then meet at mall."},
      {rank:2,points:0,answers:[
        {prompt:"Tanaka pitches a shady business scheme.",options:[
          {text:"Tell me more.",points:3},
          {text:"Sounds suspicious.",points:2},
          {text:"No thanks.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He brags about how much money he makes.",options:[
          {text:"That's impressive.",points:3},
          {text:"Money isn't everything.",points:0},
          {text:"How do you do it?",points:2}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Tanaka asks if you want to make easy money.",options:[
          {text:"I'm in.",points:3},
          {text:"Is it legal?",points:2},
          {text:"Absolutely not.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"He talks about how people are easy to manipulate.",options:[
          {text:"You're quite the salesman.",points:3},
          {text:"That's cynical.",points:2},
          {text:"That's terrible.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"A customer confronts him about a scam.",options:[
          {text:"Smooth talking.",points:3},
          {text:"Maybe you went too far.",points:2},
          {text:"You deserved that.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Tanaka reveals his humble origins.",options:[
          {text:"That explains a lot.",points:3},
          {text:"You've come a long way.",points:3},
          {text:"So what?",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"He admits he's lonely despite his wealth.",options:[
          {text:"Money can't buy happiness.",points:3},
          {text:"You have me.",points:3},
          {text:"Cry me a river.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"Tanaka questions what he really wants in life.",options:[
          {text:"It's not too late to change.",points:3},
          {text:"Only you can decide.",points:2},
          {text:"Just keep making money.",points:0}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Tower": {
    character: "Mutatsu",
    arcana: "Tower",
    description: "A grumpy retired monk drinking away his sorrows at Club Escapade. Estranged from his family.",
    automatic: false,
    availableDays: [4,5,6], // Thu, Fri, Sat
    timeSlot: "evening",
    unlockDate: {month:5,day:28},
    endDate: null,
    location: "Club Escapade, Paulownia Mall",
    statRequirements: {courage:3},
    ranks: [
      {rank:1,points:0,note:"Requires Determined Courage. Talk to Mutatsu at Club Escapade."},
      {rank:2,points:0,answers:[
        {prompt:"Mutatsu is drinking and grumbling.",options:[
          {text:"Rough day?",points:3},
          {text:"Want to talk?",points:2},
          {text:"You drink too much.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He complains about young people these days.",options:[
          {text:"Tell me what it was like before.",points:3},
          {text:"Times change.",points:2},
          {text:"OK, boomer.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Mutatsu mentions he used to be a monk.",options:[
          {text:"Why did you quit?",points:3},
          {text:"That's unexpected.",points:2},
          {text:"You don't seem like one.",points:1}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"He talks about leaving his family behind.",options:[
          {text:"Do you miss them?",points:3},
          {text:"That must weigh on you.",points:3},
          {text:"That was selfish.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"He admits he was a terrible father.",options:[
          {text:"It's not too late.",points:3},
          {text:"At least you realize it.",points:2},
          {text:"You're right about that.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Mutatsu is thinking about reaching out to his son.",options:[
          {text:"You should do it.",points:3},
          {text:"He might not forgive you.",points:2},
          {text:"Don't bother.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"He's afraid of being rejected by his family.",options:[
          {text:"You won't know until you try.",points:3},
          {text:"I understand your fear.",points:2},
          {text:"You deserve it.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"Mutatsu has decided to face his past.",options:[
          {text:"I'm proud of you.",points:3},
          {text:"That takes real courage.",points:3},
          {text:"About time.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Star": {
    character: "Mamoru Hayase",
    arcana: "Star",
    description: "A rival athlete juggling sports, part-time jobs, and caring for his family after his father's passing.",
    automatic: false,
    availableDays: [1,3,5], // Mon, Wed, Fri
    timeSlot: "day",
    unlockDate: {month:8,day:2},
    endDate: null,
    location: "Iwatodai Strip Mall",
    statRequirements: {courage:3},
    ranks: [
      {rank:1,points:0,note:"Requires Determined Courage. Talk to Mamoru at the strip mall."},
      {rank:2,points:0,answers:[
        {prompt:"Mamoru talks about competing in nationals.",options:[
          {text:"You can do it!",points:3},
          {text:"Sounds intense.",points:2},
          {text:"Don't get your hopes up.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He mentions working multiple part-time jobs.",options:[
          {text:"That's really tough.",points:3},
          {text:"You work hard.",points:3},
          {text:"Why so many?",points:1}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Mamoru reveals he supports his siblings alone.",options:[
          {text:"You're an amazing brother.",points:3},
          {text:"That's a lot of responsibility.",points:2},
          {text:"That's not fair to you.",points:1}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"He's exhausted from balancing sports and work.",options:[
          {text:"Don't push yourself too hard.",points:3},
          {text:"I wish I could help.",points:3},
          {text:"Something's gotta give.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"His grades are slipping.",options:[
          {text:"Want to study together?",points:3},
          {text:"Prioritize what matters.",points:2},
          {text:"Just focus on sports.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Mamoru is considering quitting sports for work.",options:[
          {text:"Don't give up your dream.",points:3},
          {text:"Your family needs you too.",points:2},
          {text:"Sports won't pay bills.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"He got a scholarship offer.",options:[
          {text:"That's incredible!",points:3},
          {text:"You earned it.",points:3},
          {text:"Lucky break.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"Mamoru thanks you for being his rival and friend.",options:[
          {text:"You pushed me too.",points:3},
          {text:"I'll always be cheering for you.",points:3},
          {text:"Sure.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Moon": {
    character: "Nozomi Suemitsu",
    arcana: "Moon",
    description: "The self-proclaimed Gourmet King who hides insecurity behind bravado and a cult-like following.",
    automatic: false,
    availableDays: [1,2,3,4,5,6], // Mon-Sat
    timeSlot: "day",
    unlockDate: {month:4,day:28},
    endDate: null,
    location: "School Gate, Gekkoukan",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Talk to Nozomi at the school gate"},
      {rank:2,points:0,answers:[
        {prompt:"Nozomi is bragging about his gourmet expertise.",options:[
          {text:"You know a lot!",points:3},
          {text:"Teach me.",points:2},
          {text:"That's just food.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He takes you to his favorite restaurant.",options:[
          {text:"This is delicious!",points:3},
          {text:"Not bad.",points:2},
          {text:"I've had better.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Nozomi mentions his 'followers' at school.",options:[
          {text:"You're popular.",points:3},
          {text:"That's an interesting group.",points:2},
          {text:"They're not real friends.",points:0}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"He invites you to join his 'cult of food.'",options:[
          {text:"Sounds fun!",points:3},
          {text:"I'll think about it.",points:2},
          {text:"That's weird.",points:0}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Some students are making fun of him behind his back.",options:[
          {text:"Don't listen to them.",points:3},
          {text:"That's cruel.",points:2},
          {text:"Can you blame them?",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"Nozomi reveals he feels insecure about himself.",options:[
          {text:"You're fine the way you are.",points:3},
          {text:"Everyone feels that way sometimes.",points:2},
          {text:"Maybe change then.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"His followers abandoned him.",options:[
          {text:"You still have me.",points:3},
          {text:"Real friends stay.",points:3},
          {text:"I saw that coming.",points:0}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"He wants to become someone people genuinely like.",options:[
          {text:"You already are.",points:3},
          {text:"Just be yourself.",points:3},
          {text:"Good luck.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Sun": {
    character: "Akinari Kamiki",
    arcana: "Sun",
    description: "A sickly young man writing a story at the shrine. Facing death with quiet courage and a fading pen.",
    automatic: false,
    availableDays: [0], // Sunday only
    timeSlot: "day",
    unlockDate: {month:8,day:9},
    endDate: null,
    location: "Naganaki Shrine",
    statRequirements: {academics:3,charm:3},
    ranks: [
      {rank:1,points:0,note:"Requires Average Academics & Smooth Charm. Talk to Akinari on Sunday."},
      {rank:2,points:0,answers:[
        {prompt:"Akinari is writing in his notebook.",options:[
          {text:"What are you writing?",points:3},
          {text:"You seem focused.",points:2},
          {text:"I'll leave you alone.",points:0}
        ]}
      ]},
      {rank:3,points:15,answers:[
        {prompt:"He shares a part of his story with you.",options:[
          {text:"It's really good.",points:3},
          {text:"I want to hear more.",points:3},
          {text:"It's okay.",points:0}
        ]}
      ]},
      {rank:4,points:15,answers:[
        {prompt:"Akinari reveals he has a terminal illness.",options:[
          {text:"I'm so sorry.",points:3},
          {text:"How are you feeling?",points:2},
          {text:"That's awful.",points:1}
        ]}
      ]},
      {rank:5,points:15,answers:[
        {prompt:"He questions the meaning of living when death is certain.",options:[
          {text:"Life has meaning because it ends.",points:3},
          {text:"Every day matters.",points:3},
          {text:"I don't know.",points:1}
        ]}
      ]},
      {rank:6,points:22,answers:[
        {prompt:"Akinari is struggling to write the ending of his story.",options:[
          {text:"Take your time with it.",points:3},
          {text:"What kind of ending do you want?",points:2},
          {text:"Just finish it.",points:0}
        ]}
      ]},
      {rank:7,points:22,answers:[
        {prompt:"He's getting weaker but keeps writing.",options:[
          {text:"Your determination is inspiring.",points:3},
          {text:"Please take care of yourself.",points:2},
          {text:"Maybe you should stop.",points:0}
        ]}
      ]},
      {rank:8,points:22,answers:[
        {prompt:"Akinari reads you the latest chapter — it's about hope.",options:[
          {text:"It's beautiful.",points:3},
          {text:"You've poured your soul into this.",points:3},
          {text:"It's sad.",points:1}
        ]}
      ]},
      {rank:9,points:22,answers:[
        {prompt:"He says meeting you gave his life meaning.",options:[
          {text:"You gave mine meaning too.",points:3},
          {text:"I'll never forget you.",points:3},
          {text:"Don't say that.",points:1}
        ]}
      ]},
      {rank:10,points:22,note:"Rank up is automatic after the event."}
    ]
  },
  "Judgement": {
    character: "Nyx Annihilation Team",
    arcana: "Judgement",
    description: "The resolve of everyone who chose to face the end. Born from humanity's determination to live.",
    automatic: true,
    availableDays: [],
    timeSlot: null,
    unlockDate: {month:12,day:31},
    endDate: null,
    location: "Iwatodai Dorm",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Automatic — Dec 31 onwards"},
      {rank:2,points:0,note:"Automatic — Jan 1"},
      {rank:3,points:0,note:"Automatic — story progression"},
      {rank:4,points:0,note:"Automatic — story progression"},
      {rank:5,points:0,note:"Automatic — story progression"},
      {rank:6,points:0,note:"Automatic — story progression"},
      {rank:7,points:0,note:"Automatic — story progression"},
      {rank:8,points:0,note:"Automatic — story progression"},
      {rank:9,points:0,note:"Automatic — story progression"},
      {rank:10,points:0,note:"Automatic — story progression"}
    ]
  },
  "Aeon": {
    character: "Aigis",
    arcana: "Aeon",
    description: "An anti-Shadow weapon in human form, learning the meaning of life and her feelings for you.",
    automatic: false,
    availableDays: [1,2,3,4,5,6],
    timeSlot: "day",
    unlockDate: {month:1,day:8},
    endDate: {month:1,day:30},
    location: "Classroom 2F, Gekkoukan",
    statRequirements: {},
    ranks: [
      {rank:1,points:0,note:"Talk to Aigis in classroom after Jan 8"},
      {rank:2,points:0,answers:[
        {prompt:"Aigis asks about human emotions.",options:[
          {text:"They make us who we are.",points:3},
          {text:"They can be complicated.",points:2},
          {text:"They're a weakness.",points:0}
        ]}
      ]},
      {rank:3,points:10,answers:[
        {prompt:"She wants to understand what friendship means.",options:[
          {text:"It's what we have.",points:3},
          {text:"Caring about someone.",points:3},
          {text:"It's hard to explain.",points:1}
        ]}
      ]},
      {rank:4,points:10,answers:[
        {prompt:"Aigis questions her purpose beyond fighting.",options:[
          {text:"You're more than a weapon.",points:3},
          {text:"You can be anything.",points:2},
          {text:"Fighting is your purpose.",points:0}
        ]}
      ]},
      {rank:5,points:10,answers:[
        {prompt:"She asks what it means to be alive.",options:[
          {text:"You're alive right now.",points:3},
          {text:"It's about connections.",points:3},
          {text:"I'm not sure you are.",points:0}
        ]}
      ]},
      {rank:6,points:15,answers:[
        {prompt:"Aigis says she wants to protect you specifically.",options:[
          {text:"I want to protect you too.",points:3},
          {text:"Thank you, Aigis.",points:2},
          {text:"That's your programming.",points:0}
        ]}
      ]},
      {rank:7,points:15,answers:[
        {prompt:"She's experiencing something she thinks might be sadness.",options:[
          {text:"That means you have a heart.",points:3},
          {text:"It's okay to feel sad.",points:3},
          {text:"Machines don't feel.",points:0}
        ]}
      ]},
      {rank:8,points:15,answers:[
        {prompt:"Aigis has found her own answer about life.",options:[
          {text:"I'd love to hear it.",points:3},
          {text:"You've grown so much.",points:2},
          {text:"Go ahead.",points:1}
        ]}
      ]},
      {rank:9,points:15,answers:[
        {prompt:"She tells you what you mean to her.",options:[
          {text:"You mean just as much to me.",points:3},
          {text:"I'm glad we met.",points:3},
          {text:"Thank you.",points:1}
        ]}
      ]},
      {rank:10,points:15,note:"Rank up is automatic after the event."}
    ]
  }
};
