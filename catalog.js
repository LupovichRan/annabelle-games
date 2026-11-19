/* catalog.js – the single source of truth for the games of the site + the kid's own LIBRARY ("my games") + the calm-mode preference.
   No dependencies (uses window.KidApp when it is there). Load it with a plain <script src="catalog.js"></script> after playtime.js.

   window.GameCatalog = {
     list            every game: {id, file, emo, n:{he,fr,en}, d:{he,fr,en}, cat, ages:[min,max], tags:[..], learn, online, two, calm:1..3,
                     mins, size:'S'|'M'|'L', isNew, grad:[c1,c2], parent?}   (parent: a mode of another game – never listed on its own)
     cats            [{id, emo, n:{he,fr,en}}]   learn | cats | sport | adventure | retro | puzzle
     packs           [{id, emo, n, d}]  + packIds(packId) -> ids
     byId(id)  name(id, lang?)  desc(id, lang?)  href(id)  tagName(tag, lang?)  fits(id, age)
     available(id)   false while the page is not published yet (PENDING below) -> hidden everywhere
     visible()       the games a store / menu may show (available, not a sub-mode)

     LIBRARY (per profile; localStorage 'annabelle-library' = {v:1, on:[ids in the kid's order], off:[ids the kid removed], t:{id:installDay}, ob:1, a?:age, u?:1})
     lib() -> installed ids in order (runs ensure() the first time)     has(id)   add(id) -> bool   remove(id) -> bool   move(id, index) -> bool
     addMany(ids) -> the ids that were really added (for undo)          removeMany(ids)
     ensure()        first-run migration: an existing player keeps every game ever played + favourites (topped up to 6);
                     a brand-new player gets a starter pack of 6 (2 learning, 2 calm, 2 fun) for the age band. Never installs everything.
     starter(n?)     the starter picks for the current kid               suggest(n?) -> [{id, why:'like'|'learn'|'calm'|'age'}]
     onchange(cb)    cb(reason) after every library / calm change (also from another tab)
     precache(ids)   asks the service worker cache to hold these game pages for offline use (best effort, silent)
     Removing a game NEVER touches its save or progress: only this list changes.

     CALM MODE (localStorage 'annabelle-calm': '0' = lively, anything else / missing = calm, the default for everybody)
     calm() -> bool   setCalm(bool)      Modules without catalog.js read the key directly:  localStorage.getItem('annabelle-calm') !== '0'
     A change also fires  window 'annabelle-calm' (CustomEvent, detail {calm:bool})  and sets  <html data-calm="1|0">.
   } */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.GameCatalog) return;
  var KEY = 'annabelle-library', CALM_KEY = 'annabelle-calm', ID_RE = /^[a-z0-9]{1,24}$/;

  /* pages that are being written right now: listed here = hidden everywhere. The lead removes an id when its page ships
     (critters.html exists in the tree but is still in progress: delete the id below to publish it in the store and in starter picks). */
  var PENDING = {};

  var CATS = [
    {id: 'learn', emo: '🎓', n: {he: 'לומדים', fr: 'Apprendre', en: 'Learning'}},
    {id: 'cats', emo: '🐱', n: {he: 'חתולים', fr: 'Chats', en: 'Cats'}},
    {id: 'puzzle', emo: '🧩', n: {he: 'חשיבה', fr: 'Réflexion', en: 'Thinking'}},
    {id: 'sport', emo: '⚽', n: {he: 'ספורט ואקשן', fr: 'Sport et action', en: 'Sport & action'}},
    {id: 'adventure', emo: '🌊', n: {he: 'הרפתקאות', fr: 'Aventures', en: 'Adventures'}},
    {id: 'retro', emo: '🕹️', n: {he: 'רטרו', fr: 'Rétro', en: 'Retro'}}
  ];

  var TAGS = {
    animals: ['חיות', 'animaux', 'animals'], cats: ['חתולים', 'chats', 'cats'], care: ['טיפול', 'prendre soin', 'caring'],
    memory: ['זיכרון', 'mémoire', 'memory'], logic: ['היגיון', 'logique', 'logic'], math: ['חשבון', 'maths', 'math'],
    reading: ['קריאה', 'lecture', 'reading'], english: ['אנגלית', 'anglais', 'English'], science: ['מדע', 'sciences', 'science'],
    money: ['כסף', 'argent', 'money'], race: ['מרוץ', 'course', 'racing'], ball: ['כדור', 'ballon', 'ball'],
    cooking: ['בישול', 'cuisine', 'cooking'], classic: ['קלאסיקה', 'classique', 'classic'], music: ['מוזיקה', 'musique', 'music'],
    magic: ['קסמים', 'magie', 'magic'], board: ['משחק לוח', 'jeu de plateau', 'board game'], build: ['בנייה', 'construction', 'building'],
    fishing: ['דיג', 'pêche', 'fishing'], story: ['סיפור', 'histoire', 'story'], reflex: ['תגובה מהירה', 'réflexes', 'reflexes'],
    exam: ['בגרות', 'examen', 'exam'], search: ['חיפוש', 'cherche et trouve', 'seek and find']
  };

  /* g(id, emoji, category, ages, calm, minutes, size, flags, gradient, names, one calm sentence, tags)
     flags: l = learning game · o = 1-v-1 online · 2 = two players on one device · n = new */
  var LIST = [];
  function g(id, emo, cat, ages, calm, mins, size, fl, grad, n, d, tags, parent) {
    var o = {id: id, file: id + '.html', emo: emo, n: {he: n[0], fr: n[1], en: n[2]}, d: {he: d[0], fr: d[1], en: d[2]}, cat: cat, ages: ages, tags: tags,
      learn: fl.indexOf('l') >= 0, online: fl.indexOf('o') >= 0, two: fl.indexOf('2') >= 0, calm: calm, mins: mins, size: size, isNew: fl.indexOf('n') >= 0, grad: grad};
    if (parent) o.parent = parent;
    LIST.push(o);
  }
  /* ---- learning ---- */
  g('mathquest', '🧮', 'learn', [5, 12], 2, 5, 'M', 'l', ['#7c5cff', '#2a8fd0'], ['מסע החשבון', 'La quête des maths', 'Math Quest'],
    ['פותרים תרגילי חשבון ומתקדמים במסע, בקצב שלך.', 'On résout des calculs et on avance dans la quête, à son rythme.', 'Solve sums and move along the quest at your own pace.'], ['math']);
  g('wordcity', '🔤', 'learn', [5, 12], 1, 5, 'M', 'l', ['#ffb84d', '#e0457b'], ['עיר המילים', 'La ville des mots', 'Word City'],
    ['לומדים מילים באנגלית ובונים עיר, מילה אחרי מילה.', 'On apprend des mots d’anglais et on construit une ville, mot après mot.', 'Learn English words and build a city, one word at a time.'], ['english', 'reading', 'build']);
  g('sciencelab', '🔬', 'learn', [6, 14], 1, 6, 'L', 'l', ['#4fd18b', '#1d6fb8'], ['מעבדת המדע', 'Le labo des sciences', 'Science Lab'],
    ['ניסויים קטנים ושאלות על איך העולם עובד.', 'De petites expériences et des questions sur le monde.', 'Small experiments and questions about how the world works.'], ['science']);
  g('reading', '📖', 'learn', [4, 9], 1, 5, 'M', 'ln', ['#ffd166', '#ef6f6c'], ['סולם הקריאה', 'L\'échelle de lecture', 'Reading Ladder'],
    ['מתרגלים קריאה צעד אחר צעד, מאותיות ועד משפטים.', 'On s’entraîne à lire pas à pas, des lettres aux phrases.', 'Practise reading step by step, from letters to sentences.'], ['reading']);
  g('thinking', '🧩', 'learn', [6, 18], 1, 5, 'M', 'ln', ['#ff8fb3', '#7c5cff'], ['חידות חשיבה', 'Défis de logique', 'Thinking Lab'],
    ['חידות היגיון קצרות, בלי שעון ובלי לחץ.', 'De courtes énigmes de logique, sans chrono et sans stress.', 'Short logic puzzles with no clock and no rush.'], ['logic']);
  g('city', '🏙️', 'learn', [8, 18], 1, 8, 'M', 'ln', ['#5ec8ff', '#7c5cff'], ['עיר החתולים', 'Chat-Ville', 'Kitty City'],
    ['מרוויחים מטבעות ולומדים לנהל כסף בעיר של חתולים.', 'On gagne des pièces et on apprend à gérer son argent à Chat-Ville.', 'Earn coins and learn to manage money in a city of cats.'], ['money', 'build', 'cats']);
  g('bagrut', '🎓', 'learn', [16, 18], 1, 10, 'L', 'ln', ['#5b8def', '#3a3f8f'], ['מסלול הבגרות', 'Objectif Bagrout', 'Bagrut Track'],
    ['תרגול מתמטיקה לבגרות, נושא אחרי נושא.', 'Des exercices de maths pour le bac israélien, thème après thème.', 'Maths practice for the Bagrut exam, topic by topic.'], ['math', 'exam']);
  /* ---- cats ---- */
  g('bubbles', '💧', 'cats', [5, 12], 2, 3, 'S', '', ['#b48bff', '#7c5cff'], ['בועות החתולים', 'Bulles de chats', 'Cat Bubbles'],
    ['מפוצצים רק את הבועות עם החיות הנכונות.', 'On éclate seulement les bulles avec les bons animaux.', 'Pop only the bubbles with the right animals.'], ['cats', 'animals', 'reflex']);
  g('streetcats', '🐈', 'cats', [4, 12], 1, 5, 'M', '', ['#ffc46b', '#e8862d'], ['חתולי השכונה', 'Chats du quartier', 'Street Cats'],
    ['מאכילים, מלטפים ומטפלים בחתולי החצר.', 'On nourrit, on caresse et on soigne les chats de la cour.', 'Feed, pet and care for the cats in the yard.'], ['cats', 'care']);
  g('soya', '🐈', 'cats', [4, 12], 1, 5, 'M', '', ['#6b5a7e', '#2e2438'], ['סויה החתול', 'Soya le chat', 'Soya the Cat'],
    ['חתול משלך בחדר: מלטפים, מאכילים ומשחקים איתו.', 'Un chat rien qu’à toi dans ta chambre : caresses, repas et jeux.', 'Your own cat in your room: pet it, feed it and play.'], ['cats', 'care']);
  g('soyahome', '🌱', 'cats', [5, 12], 2, 4, 'M', '', ['#ffb86b', '#e8607a'], ['סויה בבית', 'Soya à la maison', 'Soya at Home'],
    ['סויה עושה בלגן, ואנחנו שומרים על הבית.', 'Soya fait des bêtises, et on garde la maison en ordre.', 'Soya makes a mess and we keep the house in order.'], ['cats', 'care']);
  g('kitchen', '🍔', 'cats', [5, 12], 2, 4, 'S', '', ['#ffa6c9', '#ff5c93'], ['מסעדת החתולים', 'Le Resto des Chats', 'Cat Kitchen'],
    ['מכינים אוכל ללקוחות מצחיקים.', 'On prépare à manger pour des clients rigolos.', 'Cook meals for funny customers.'], ['cats', 'cooking']);
  /* ---- thinking / puzzle ---- */
  g('cats', '🃏', 'puzzle', [4, 12], 1, 3, 'S', 'o', ['#5fd38d', '#2fb36a'], ['זוגות של חתולים', 'Mémoire des chats', 'Cat Memory'],
    ['הופכים קלפים ומוצאים זוגות של חתולים.', 'On retourne les cartes et on trouve les paires de chats.', 'Flip the cards and find the pairs of cats.'], ['memory', 'cats']);
  g('hiddencats', '🔍', 'puzzle', [4, 12], 1, 4, 'M', '', ['#ff9ec7', '#c86dd7'], ['מצאי את החתולים', 'Trouve les chats', 'Find the Cats'],
    ['מחפשים בנחת חתולים שמתחבאים בציור.', 'On cherche tranquillement les chats cachés dans le dessin.', 'Look calmly for the cats hiding in the picture.'], ['search', 'cats']);
  g('escape', '🔑', 'puzzle', [6, 14], 1, 10, 'L', '', ['#4fd1c5', '#2b8a9e'], ['הבריחה מבית העץ', 'Évasion de la cabane', 'Treehouse Escape'],
    ['מוצאים רמזים, פותרים חידות ויוצאים מבית העץ.', 'On trouve des indices, on résout des énigmes et on sort de la cabane.', 'Find clues, solve riddles and get out of the treehouse.'], ['logic', 'story', 'search']);
  g('minesweeper', '🐶', 'puzzle', [7, 18], 1, 5, 'S', '', ['#8fdc5a', '#3d8a3a'], ['גינת החתולים', 'Jardin des chats', 'Cat Garden'],
    ['חושבים לפי המספרים איפה מתחבאים הכלבלבים.', 'On réfléchit avec les chiffres pour deviner où se cachent les chiots.', 'Use the numbers to work out where the puppies hide.'], ['logic', 'classic']);
  g('checkers', '♟️', 'puzzle', [7, 18], 1, 10, 'S', 'o2', ['#9aa3ad', '#f5973a'], ['דמקת חתולים', 'Dames des chats', 'Cat Checkers'],
    ['דמקה רגועה מול המחשב או מול מישהו לידך.', 'Une partie de dames tranquille contre l’ordinateur ou à deux.', 'A quiet game of checkers against the computer or a friend.'], ['board', 'logic', 'classic']);
  g('tictactoe', '🐱', 'puzzle', [5, 18], 1, 2, 'S', 'o2', ['#8f7bff', '#4a2f9a'], ['איקס עיגול חתולים', 'Morpion des chats', 'Cat Tic-Tac-Toe'],
    ['שלושה בשורה, סיבוב קצר לשניים.', 'Trois à la suite : une petite partie à deux.', 'Three in a row: a short game for two.'], ['board', 'classic']);
  g('cups', '🥤', 'puzzle', [4, 12], 2, 2, 'S', 'o', ['#ff8a5c', '#c4243e'], ['איפה הכדור?', 'Où est la balle ?', 'Cup Shuffle'],
    ['עוקבים בעיניים אחרי הכדור מתחת לכוסות.', 'On suit des yeux la balle cachée sous les gobelets.', 'Keep your eyes on the ball under the cups.'], ['memory', 'magic']);
  g('magic', '🎩', 'puzzle', [7, 16], 1, 3, 'S', '2', ['#b985f5', '#6a35b8'], ['קסם הקלפים', 'Magie des cartes', 'Card Magic'],
    ['לומדים קסם קלפים ומראים אותו לחברים.', 'On apprend un tour de cartes pour le montrer aux copains.', 'Learn a card trick and show it to a friend.'], ['magic', 'math']);
  g('magic2', '😺', 'puzzle', [6, 16], 1, 3, 'S', '', ['#b985f5', '#6a35b8'], ['קסם החתולים', 'Magie des chats', 'Magic Cats'],
    ['הקוסם מנחש את הקלף שלך, ואז מגלים איך.', 'Le magicien devine ta carte, puis on découvre le secret.', 'The magician guesses your card, then you learn how.'], ['magic', 'cats']);
  /* ---- sport & action ---- */
  g('funrun', '👟', 'sport', [6, 14], 3, 2, 'M', 'o', ['#ff6fb5', '#ff8a3d'], ['מרוץ התעלולים', 'La course aux farces', 'Prank Race'],
    ['רצים, קופצים ועושים תעלולים מצחיקים במרוץ.', 'On court, on saute et on fait des farces pendant la course.', 'Run, jump and play funny pranks in a race.'], ['race', 'reflex']);
  g('carrace', '🏎️', 'sport', [6, 18], 3, 3, 'M', 'o', ['#ff5a5a', '#b3206a'], ['מרוץ מכוניות החתולים', 'Course de karts des chats', 'Kitty Kart Race'],
    ['מרוץ קארטינג מהיר עם סיבובים וטורבו.', 'Une course de karts rapide avec des virages et du turbo.', 'A fast kart race with drifts and turbo.'], ['race', 'cats', 'reflex']);
  g('football', '⚽', 'sport', [6, 18], 3, 3, 'M', 'o', ['#6fe08a', '#1f9a46'], ['כדורגל חתולים', 'Foot des chats', 'Cat Football'],
    ['משחק כדורגל קצר של חתולים.', 'Un petit match de foot entre chats.', 'A short football match between cats.'], ['ball', 'cats']);
  g('thunderkittens', '⚡', 'sport', [7, 16], 3, 3, 'M', 'o', ['#7c5cff', '#2a1a6e'], ['לוחמי הברק', 'Guerriers de la Foudre', 'Lightning Kittens'],
    ['קרבות חתלתולים מהירים, גל אחרי גל.', 'Des combats de chatons rapides, vague après vague.', 'Fast kitten battles, wave after wave.'], ['cats', 'reflex']);
  g('bowling', '🎳', 'sport', [5, 18], 1, 5, 'M', 'o2', ['#d86bff', '#5a2a9a'], ['באולינג חתולים', 'Bowling des chats', 'Bowling Cats'],
    ['מגלגלים את הכדור בנחת ומפילים פינים.', 'On lance la boule tranquillement et on fait tomber les quilles.', 'Roll the ball calmly and knock down the pins.'], ['ball', 'cats']);
  g('runner', '🦁', 'sport', [5, 12], 3, 2, 'M', '', ['#ff8fb8', '#ff4d8d'], ['המרוץ בסוואנה', 'Course dans la savane', 'Savanna Run'],
    ['רצים בסוואנה וקופצים מעל מכשולים.', 'On court dans la savane et on saute les obstacles.', 'Run across the savanna and jump over obstacles.'], ['race', 'animals', 'reflex']);
  g('runner3d', '🏞️', 'sport', [6, 12], 3, 2, 'S', '', ['#ff8fb8', '#ff4d8d'], ['המרוץ בסוואנה 3D', 'Savane 3D', 'Savanna Run 3D'],
    ['המרוץ בסוואנה בתלת־ממד.', 'La course dans la savane en 3D.', 'The savanna run in 3D.'], ['race', 'animals', 'reflex'], 'runner');
  g('pacman', '🐯', 'sport', [5, 12], 3, 3, 'M', '', ['#ffb84d', '#ff7a1f'], ['הטיגריס הרעבתן', 'Le tigre gourmand', 'Hungry Tiger'],
    ['הטיגריס אוכל הכול במבוך ובורח מהרודפים.', 'Le tigre mange tout dans le labyrinthe et échappe aux poursuivants.', 'The tiger eats its way through a maze and dodges the chasers.'], ['classic', 'animals', 'reflex']);
  /* ---- adventures ---- */
  g('lionking', '🦁', 'adventure', [5, 12], 2, 5, 'M', '', ['#ffd36b', '#ff8a3d'], ['הרפתקת האריה הקטן', 'Aventure du petit lion', 'Little Lion\'s Adventure'],
    ['מסע של אריה קטן בסוואנה עם זריחת השמש.', 'Le voyage d’un petit lion dans la savane au lever du soleil.', 'A little lion’s journey across the savanna at sunrise.'], ['animals', 'story']);
  g('hole', '🕳️', 'adventure', [4, 12], 2, 2, 'S', '', ['#ff7aa8', '#7a3fb0'], ['החור הרעבתן', 'Le Gouffre Gourmand', 'Hungry Hole'],
    ['בולעים הכול וגדלים לחור ענק.', 'On avale tout et on devient un trou géant.', 'Swallow everything and grow into a giant hole.'], ['reflex']);
  g('fishy', '🐟', 'adventure', [4, 12], 2, 3, 'M', '', ['#5cc8ff', '#1d6fb8'], ['דגיגון רעבתן', 'Petit Poisson Gourmand', 'Hungry Fishy'],
    ['אוכלים דגים קטנים, גדלים ונזהרים מהגדולים.', 'On mange les petits poissons, on grandit et on évite les gros.', 'Eat the small fish, grow, and keep away from the big ones.'], ['animals', 'reflex']);
  g('fishing', '🎣', 'adventure', [4, 12], 2, 3, 'S', '', ['#5ac8ff', '#2a8fd0'], ['מסע הדיג', 'La pêche', 'Fishing Trip'],
    ['יוצאים בסירה ודגים דגים בדיוק ברגע הנכון.', 'On part en bateau et on pêche au bon moment.', 'Go out in a boat and catch fish at just the right moment.'], ['fishing', 'animals']);
  g('digrod', '💪', 'adventure', [5, 12], 1, 4, 'S', '', ['#5ac8ff', '#2f8fd0'], ['חכת השריר', 'La Canne Muscle', 'Muscle Rod Dig'],
    ['חופרים עמוק ומוציאים חיות מהאדמה.', 'On creuse profond et on sort des animaux de la terre.', 'Dig deep and pull animals out of the ground.'], ['fishing', 'animals']);
  g('towerdefense', '🏰', 'adventure', [7, 16], 2, 8, 'L', '', ['#7fbf5a', '#3d8a3a'], ['שומרי המאורה', 'Gardiens de la tanière', 'Tiger Den Defense'],
    ['מציבים טיגריסים על השביל ושומרים על המאורה.', 'On place des tigres sur le chemin pour protéger la tanière.', 'Place tigers along the path to guard the den.'], ['logic', 'animals']);
  g('critters', '🐾', 'adventure', [5, 14], 1, 6, 'M', 'n', ['#7bd88f', '#2a9d8f'], ['עולם היצורים', 'Le monde des créatures', 'Critter World'],
    ['הרפתקה של חברות, משחק ולמידה עם יצורים קטנים.', 'Une aventure d’amitié, de jeu et de découvertes avec de petites créatures.', 'An adventure of friendship, play and learning with little critters.'], ['animals', 'story']);
  /* ---- retro ---- */
  g('retro', '🕹️', 'retro', [6, 16], 2, 3, 'S', '', ['#7c5cff', '#3b2a8f'], ['פינת הרטרו', 'Coin rétro', 'Retro Corner'],
    ['כל משחקי הרטרו במקום אחד, עם חיות שמצילים.', 'Tous les jeux rétro au même endroit, avec des animaux à sauver.', 'All the retro games in one place, with animals to rescue.'], ['classic', 'animals']);
  g('invaders', '🚀', 'retro', [6, 16], 3, 3, 'M', 'o', ['#6a5bf0', '#2a1a8a'], ['פולשי החלל', 'Envahisseurs', 'Space Rescue'],
    ['מצילים חיות מפולשים מהחלל.', 'On sauve les animaux des envahisseurs de l’espace.', 'Rescue the animals from space invaders.'], ['classic', 'reflex']);
  g('tetris', '🧱', 'retro', [7, 18], 2, 5, 'M', 'o', ['#ffa24d', '#e0561f'], ['טטריס חתולים', 'Tetris des chats', 'Kitty Blocks'],
    ['מסדרים קוביות נופלות לשורות מלאות.', 'On range les blocs qui tombent pour faire des lignes.', 'Fit the falling blocks into full rows.'], ['classic', 'logic']);
  g('breakout', '🐾', 'retro', [6, 16], 2, 3, 'M', 'o', ['#4fd18b', '#1f8f5a'], ['שוברת הכלובים', 'Casse-cages', 'Cage Breaker'],
    ['מקפיצים כדור, שוברים כלובים ומשחררים חיות.', 'On fait rebondir la balle pour casser les cages et libérer les animaux.', 'Bounce the ball to break the cages and free the animals.'], ['classic', 'ball']);
  g('snake', '🐯', 'retro', [6, 18], 2, 3, 'M', 'o', ['#ffc857', '#ff8a1f'], ['זנב הנמר', 'Queue de tigre', 'Tiger Tail'],
    ['הנמר אוכל והזנב שלו מתארך.', 'Le tigre mange et sa queue s’allonge.', 'The tiger eats and its tail gets longer.'], ['classic', 'animals']);
  g('crossing', '🐥', 'retro', [5, 12], 2, 3, 'M', 'o', ['#6bb8ff', '#2f6fd8'], ['מעבר החיות', 'Passage des animaux', 'Animal Crossing'],
    ['מעבירים גורים בבטחה עד המרפאה.', 'On fait traverser les petits animaux jusqu’à la clinique.', 'Lead the baby animals safely to the clinic.'], ['classic', 'animals']);
  g('pong', '🏓', 'retro', [5, 18], 2, 3, 'M', 'o2', ['#ff7eb6', '#c2337a'], ['פינג־פונג כפות', 'Ping-pong des pattes', 'Paw Pong'],
    ['פינג־פונג פשוט, לבד או שניים על אותו מסך.', 'Un ping-pong tout simple, seul ou à deux sur le même écran.', 'Simple ping-pong, alone or two on one screen.'], ['classic', 'ball']);
  g('safari', '📸', 'retro', [4, 12], 2, 3, 'M', 'o', ['#8bd45a', '#2f8f4a'], ['ספארי צילום', 'Safari photo', 'Photo Safari'],
    ['מצלמים חיות בספארי לפני שהן מתחבאות.', 'On photographie les animaux du safari avant qu’ils se cachent.', 'Snap photos of safari animals before they hide.'], ['animals', 'reflex']);
  g('simon', '🎶', 'retro', [5, 16], 1, 4, 'M', 'o2', ['#5fd0ff', '#7c5cff'], ['מקהלת החיות', 'La chorale des animaux', 'Animal Choir'],
    ['מקשיבים למנגינה של החיות וחוזרים עליה.', 'On écoute la mélodie des animaux et on la rejoue.', 'Listen to the animals’ tune and play it back.'], ['music', 'memory', 'animals']);

  var BY = Object.create(null); LIST.forEach(function (x) { BY[x.id] = x; });

  /* curated packs: one tap adds them all (the store shows an undo). 'starter' is computed for the kid. */
  var PACKS = [
    {id: 'starter', emo: '🎒', n: {he: 'חבילת התחלה', fr: 'Pack de départ', en: 'Starter pack'},
      d: {he: 'שישה משחקים שמתאימים לגיל שלך.', fr: 'Six jeux choisis pour ton âge.', en: 'Six games picked for your age.'}},
    {id: 'quiet', emo: '🌙', n: {he: 'זמן שקט', fr: 'Moment calme', en: 'Quiet time'},
      d: {he: 'משחקים איטיים ורגועים, בלי שעון.', fr: 'Des jeux lents et calmes, sans chrono.', en: 'Slow, calm games with no clock.'},
      ids: ['streetcats', 'hiddencats', 'soya', 'cats', 'digrod']},
    {id: 'brain', emo: '🧠', n: {he: 'חדר כושר למוח', fr: 'Gym du cerveau', en: 'Brain gym'},
      d: {he: 'חידות, חשבון וזיכרון.', fr: 'Énigmes, calcul et mémoire.', en: 'Puzzles, maths and memory.'},
      ids: ['thinking', 'mathquest', 'minesweeper', 'simon', 'checkers']},
    {id: 'family', emo: '🎲', n: {he: 'ערב משפחתי', fr: 'Soirée en famille', en: 'Family night'},
      d: {he: 'משחקים לשניים על אותו מסך.', fr: 'Des jeux à deux sur le même écran.', en: 'Games for two on one screen.'},
      ids: ['bowling', 'tictactoe', 'pong', 'checkers', 'magic']},
    {id: 'trip', emo: '🚗', n: {he: 'בדרך – עובד בלי אינטרנט', fr: 'En voyage – marche hors ligne', en: 'On a trip – works offline'},
      d: {he: 'סיבובים קצרים שעובדים גם בלי רשת.', fr: 'De courtes parties qui marchent aussi sans réseau.', en: 'Short rounds that also work with no network.'},
      ids: ['hole', 'fishy', 'tetris', 'snake', 'cups']}
  ];

  /* ---------- helpers ---------- */
  function ls(k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { W.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lang() { var K = W.KidApp; try { if (K && K.lang) { var l = K.lang(); if (l === 'he' || l === 'fr' || l === 'en') return l; } } catch (e) {} var s = ls('annabelle-lang'); return s === 'fr' || s === 'en' ? s : 'he'; }
  function kid() { var K = W.KidApp, k = null; try { k = K && K.kid ? K.kid() : null; } catch (e) {} k = k && typeof k === 'object' ? k : {};
    var a = Math.floor(+k.age); return {age: isFinite(a) && a >= 3 && a <= 99 && k.age != null ? a : null, sk: k.sk && typeof k.sk === 'object' ? k.sk : {}}; }
  function byId(id) { return typeof id === 'string' && BY[id] ? BY[id] : null; }
  function available(id) { return !!byId(id) && !PENDING[id]; }
  function listable(id) { var x = byId(id); return !!x && !x.parent && !PENDING[id]; }
  function visible() { return LIST.filter(function (x) { return listable(x.id); }); }
  function name(id, l) { var x = byId(id); if (!x) return String(id); l = l || lang(); var s = x.n[l] || x.n.he;
    if (l === 'he') { try { var K = W.KidApp; if (K && K.he) s = K.he(s); } catch (e) {} } return s; }
  function desc(id, l) { var x = byId(id); return x ? (x.d[l || lang()] || x.d.he) : ''; }
  function href(id) { var x = byId(id); return x ? x.file : 'index.html'; }
  function tagName(t, l) { var a = TAGS[t]; return a ? a[{he: 0, fr: 1, en: 2}[l || lang()] || 0] : String(t); }
  function fits(id, age) { var x = byId(id); if (!x) return false; if (age == null) return x.ages[0] <= 9 && x.ages[1] >= 8; return age >= x.ages[0] && age <= x.ages[1]; }
  function today() { return Math.floor(Date.now() / 864e5); }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  /* ---------- the library ---------- */
  var L = null, listeners = [];
  function cleanIds(a) { return Array.isArray(a) ? uniq(a.filter(function (x) { return typeof x === 'string' && ID_RE.test(x); })).slice(0, 200) : null; }
  function read() { // -> a valid library object or null (missing / corrupted)
    var o = null; try { o = JSON.parse(ls(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return null;
    var on = cleanIds(o.on); if (!on) return null;
    var off = (cleanIds(o.off) || []).filter(function (x) { return on.indexOf(x) < 0; }), t = {};
    if (o.t && typeof o.t === 'object' && !Array.isArray(o.t)) on.forEach(function (id) { var d = o.t[id]; if (typeof d === 'number' && isFinite(d) && d >= 0 && d < 1e6) t[id] = Math.floor(d); });
    var r = {v: 1, on: on, off: off, t: t, ob: 1};
    if (typeof o.a === 'number' && isFinite(o.a)) r.a = Math.floor(o.a);
    if (o.u) r.u = 1;
    return r;
  }
  function write() { if (L) lset(KEY, JSON.stringify(L)); }
  function fire(why) { listeners.slice().forEach(function (f) { try { f(why); } catch (e) {} }); }

  function plays() { // {id: count} from the rewards save (read-only; rewards.js does not need to be loaded)
    var out = {}; try { var r = JSON.parse(ls('annabelle-rewards') || 'null'), p = r && r.stats && r.stats.plays;
      if (p && typeof p === 'object') Object.keys(p).forEach(function (k) { var n = +p[k]; if (BY[k] && isFinite(n) && n > 0) out[k] = n; }); } catch (e) {}
    return out;
  }
  function favourites() { // the home page keeps them in 'annabelle-launcher' {favs:['cats.html', ...]}
    var out = []; try { var s = JSON.parse(ls('annabelle-launcher') || 'null'), f = s && s.favs;
      if (Array.isArray(f)) f.forEach(function (h) { if (typeof h === 'string') { var id = h.replace(/\.html$/, ''); if (BY[id]) out.push(id); } }); } catch (e) {}
    return uniq(out);
  }
  function savedGames() { // games that left their own save on this profile ('annabelle-<id>' or 'annabelle-<id>-...'): counted as played
    var out = []; try { for (var i = 0; i < W.localStorage.length; i++) { var k = W.localStorage.key(i), m = /^(?:annabelle|soya)-([a-z0-9]+)(?:-|$)/.exec(k || '');
      if (m && BY[m[1]] && out.indexOf(m[1]) < 0) out.push(m[1]); } } catch (e) {}
    return out;
  }
  function top(id) { var x = byId(id); return x && x.parent ? x.parent : id; }

  /* starter pack: 2 learning + 2 calm + 2 fun, by age band and onboarding skills */
  var BANDS = [
    {max: 6, learn: ['reading', 'mathquest', 'wordcity'], calm: ['streetcats', 'cats', 'hiddencats', 'soya'], fun: ['hole', 'fishy', 'safari', 'bubbles']},
    {max: 9, learn: ['mathquest', 'wordcity', 'thinking', 'reading', 'sciencelab'], calm: ['hiddencats', 'streetcats', 'cats', 'digrod'], fun: ['funrun', 'hole', 'pacman', 'bowling']},
    {max: 12, learn: ['thinking', 'sciencelab', 'mathquest', 'wordcity', 'city'], calm: ['minesweeper', 'checkers', 'escape', 'hiddencats'], fun: ['carrace', 'funrun', 'tetris', 'football']},
    {max: 99, learn: ['thinking', 'city', 'sciencelab', 'mathquest'], calm: ['checkers', 'minesweeper', 'escape', 'tictactoe'], fun: ['tetris', 'carrace', 'football', 'snake']}
  ];
  function starter(n, skip) {
    n = n || 6; var k = kid(), age = k.age, a = age == null ? 8 : age, b = BANDS.filter(function (x) { return a <= x.max; })[0] || BANDS[3], out = [];
    var no = {}; (skip || []).forEach(function (id) { no[id] = 1; });
    function ok(id) { return listable(id) && !no[id] && out.indexOf(id) < 0; }
    function fit(id) { return age == null || fits(id, age); }
    var learn = b.learn.slice(), fun = b.fun.slice();
    if (a >= 16) learn.unshift('bagrut');
    var sm = +k.sk.math, se = +k.sk.english; // the weaker school skill goes first
    if (isFinite(sm) && isFinite(se) && sm !== se) { var w = sm < se ? 'mathquest' : 'wordcity', i = learn.indexOf(w); if (i > 0 && fits(w, a)) { learn.splice(i, 1); learn.unshift(w); } }
    if (+k.sk.react <= 1) fun.sort(function (x, y) { return (BY[x].calm >= 3) - (BY[y].calm >= 3); }); // slower fun first for a kid with slow reactions
    function take(src, m) { var c = 0; src.forEach(function (id) { if (c < m && ok(id) && fit(id)) { out.push(id); c++; } }); src.forEach(function (id) { if (c < m && ok(id)) { out.push(id); c++; } }); }
    take(learn, 2); take(b.calm, 2); take(fun, 2);
    if (out.length < n) take(learn.concat(b.calm, fun), n - out.length);
    if (out.length < n) visible().forEach(function (x) { if (out.length < n && ok(x.id) && fit(x.id)) out.push(x.id); });
    return out.slice(0, n);
  }
  function build() { // first run for this profile
    var p = plays(), fav = favourites().map(top), played = uniq(Object.keys(p).concat(savedGames()).map(top)), k = kid();
    var cnt = {}; Object.keys(p).forEach(function (id) { var t = top(id); cnt[t] = (cnt[t] || 0) + p[id]; });
    played.sort(function (x, y) { return (cnt[y] || 0) - (cnt[x] || 0); });
    var on = uniq(fav.concat(played)).filter(function (id) { return !!BY[id] && !BY[id].parent; }), existing = on.length > 0;
    if (on.length < 6) on = on.concat(starter(6 - on.length, on));
    var t = {}, d = today(); on.forEach(function (id) { t[id] = d; });
    var o = {v: 1, on: on, off: [], t: t, ob: 1}; if (!existing) o.a = k.age == null ? -1 : k.age; else o.u = 1;
    return o;
  }
  function ensure() {
    if (!L) L = read();
    if (!L) { L = build(); write(); return L; }
    /* an untouched starter pack made before the kid's age was known (or for another age band) is re-picked once the age is there */
    if (!L.u && typeof L.a === 'number') { var k = kid(), a = k.age == null ? -1 : k.age;
      if (a !== L.a && a !== -1) { var nb = build(); if (!nb.u) { L = nb; write(); } else { L.u = 1; write(); } } }
    return L;
  }
  function lib() { return ensure().on.filter(listable); }
  function has(id) { return ensure().on.indexOf(id) >= 0; }
  function touch() { L.u = 1; delete L.a; }
  function addOne(id) { if (!listable(id) || L.on.indexOf(id) >= 0) return false; L.on.push(id); L.t[id] = today(); var i = L.off.indexOf(id); if (i >= 0) L.off.splice(i, 1); return true; }
  function removeOne(id) { var i = L.on.indexOf(id); if (i < 0) return false; L.on.splice(i, 1); delete L.t[id]; if (L.off.indexOf(id) < 0) L.off.push(id); return true; }
  function add(id) { ensure(); if (!addOne(id)) return false; touch(); write(); fire('add'); return true; }
  function remove(id) { ensure(); if (!removeOne(id)) return false; touch(); write(); fire('remove'); return true; }
  function addMany(ids) { ensure(); var done = (Array.isArray(ids) ? ids : []).filter(function (id) { return addOne(id); }); if (done.length) { touch(); write(); fire('add'); } return done; }
  function removeMany(ids) { ensure(); var done = (Array.isArray(ids) ? ids : []).filter(function (id) { return removeOne(id); }); if (done.length) { touch(); write(); fire('remove'); } return done; }
  function move(id, index) { // index in the order lib() returns
    ensure(); var shown = lib(), from = shown.indexOf(id); if (from < 0) return false;
    index = Math.max(0, Math.min(shown.length - 1, Math.floor(+index))); if (!isFinite(index) || index === from) return false;
    shown.splice(from, 1); shown.splice(index, 0, id);
    var rest = L.on.filter(function (x) { return shown.indexOf(x) < 0; }); L.on = shown.concat(rest); touch(); write(); fire('move'); return true;
  }
  function packIds(pid) { var p = PACKS.filter(function (x) { return x.id === pid; })[0]; if (!p) return [];
    return (p.id === 'starter' ? starter(6) : p.ids).filter(listable); }

  /* recommendations: at most n, each with ONE reason. Stable (no shuffling), so the screen does not change between visits. */
  function suggest(n) {
    n = Math.max(1, Math.min(8, n || 3)); ensure();
    var k = kid(), age = k.age, p = plays(), out = [], used = {};
    var cand = visible().filter(function (x) { return L.on.indexOf(x.id) < 0 && fits(x.id, age); });
    cand.sort(function (a, b) { return (L.off.indexOf(a.id) >= 0) - (L.off.indexOf(b.id) >= 0); }); // games the kid removed come last
    function push(x, why) { if (x && !used[x.id] && out.length < n) { used[x.id] = 1; out.push({id: x.id, why: why}); } }
    /* 1. similar to what the kid plays most: same category, then shared tags */
    var mine = lib(), catW = {}, tagW = {};
    mine.forEach(function (id) { var x = BY[id], w = 1 + Math.min(20, p[id] || 0); catW[x.cat] = (catW[x.cat] || 0) + w; x.tags.forEach(function (t) { tagW[t] = (tagW[t] || 0) + w; }); });
    var like = cand.filter(function (x) { return !x.learn; }).map(function (x) { var s = (catW[x.cat] || 0) * 2; x.tags.forEach(function (t) { s += tagW[t] || 0; }); return {x: x, s: s}; })
      .filter(function (o) { return o.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    push(like[0] && like[0].x, 'like');
    /* 2. a learning pick  3. a calm pick  4. age fit */
    push(cand.filter(function (x) { return x.learn; })[0], 'learn');
    push(cand.filter(function (x) { return x.calm === 1 && !x.learn && !used[x.id]; })[0], 'calm');
    cand.forEach(function (x) { push(x, 'age'); });
    return out;
  }

  /* offline: every page fetched through the service worker (network first) is put in its cache, so a plain fetch is enough.
     A message is posted too, for a future dedicated handler in sw.js ({type:'precache', urls:[...]}); today's sw.js ignores it. */
  function precache(ids) {
    try {
      if (!/^https?:$/.test(location.protocol) || !W.navigator.serviceWorker || !W.navigator.serviceWorker.controller || W.navigator.onLine === false) return false;
      var urls = (Array.isArray(ids) ? ids : [ids]).filter(available).map(href).slice(0, 12); if (!urls.length) return false;
      try { W.navigator.serviceWorker.controller.postMessage({type: 'precache', urls: urls}); } catch (e) {}
      urls.forEach(function (u) { try { W.fetch(u, {credentials: 'same-origin'}).catch(function () {}); } catch (e) {} });
      return true;
    } catch (e) { return false; }
  }

  /* ---------- calm mode ---------- */
  function calm() { return ls(CALM_KEY) !== '0'; }
  function mark() { try { D.documentElement.setAttribute('data-calm', calm() ? '1' : '0'); } catch (e) {} }
  function setCalm(on) { lset(CALM_KEY, on ? '1' : '0'); mark();
    try { W.dispatchEvent(new CustomEvent('annabelle-calm', {detail: {calm: !!on}})); } catch (e) {}
    fire('calm'); return calm(); }
  mark();

  try { W.addEventListener('storage', function (e) { if (!e || e.key === KEY) { L = null; fire('storage'); } else if (e.key === CALM_KEY) { mark(); fire('calm'); } }); } catch (e) {}

  W.GameCatalog = {
    list: LIST, cats: CATS, packs: PACKS, tags: TAGS, PENDING: PENDING,
    byId: byId, name: name, desc: desc, href: href, tagName: tagName, fits: fits, available: available, visible: visible, packIds: packIds,
    lib: lib, has: has, add: add, remove: remove, move: move, addMany: addMany, removeMany: removeMany, ensure: function () { ensure(); return lib(); },
    starter: function (n) { return starter(n || 6); }, suggest: suggest, onchange: function (f) { if (typeof f === 'function') listeners.push(f); },
    precache: precache, calm: calm, setCalm: setCalm, KEY: KEY, CALM_KEY: CALM_KEY
  };
})();
