/* ============ say.js – shared read-aloud (browser speech synthesis) for the kids platform ============
   window.Say:
     Say.can(lang)                      -> true when speaking that language is expected to work on this device
     Say.speak(text, opts)              -> true when something was queued. opts:
          lang 'he'|'fr'|'en' (default: annabelle-lang), level 1..4 (1 = beginner = slower), slow (bool),
          kind 'letter'|'syl'|'word'|'sentence'|'story'|'ui', nikud (vocalised form of the same Hebrew text),
          plain (full-spelling form without nikud), mode ('nikud'|'plain': force one for this call), words (true = word-by-word), auto (true = automatic speech:
          honours the mute flag and needs an earlier user gesture; default false = explicit tap, always speaks),
          pitch, rate (multiplier), delay (ms before starting), onword(from,to), onstart(), onend(ok)
     Say.stop()  Say.busy()  Say.settings()  Say.hint(lang,{once})  Say.onchange(cb)  Say.voices(lang)
     Say.prep(text, opts)               -> pure text normalisation (exported for tests)
     Say.fix(lang, {from:to}, mode)     -> respell mispronounced words (mode 'nikud' | 'plain' | undefined = both)
     Say.letterName(ch)  Say.number(n)  Say.voice(lang)  Say.report(ok)  Say.stats
   Device-level settings live in localStorage 'annabelle-say' (JSON, validated on load).
   Why each workaround exists is documented next to it; the short version:
   - voices arrive late or never (Android), language tags come as he-IL / he_IL / iw-IL / iw_IL, and Chrome on Android
     lists languages rather than installed voices, so the list alone cannot prove that Hebrew will be spoken;
   - cancel() directly followed by speak() is swallowed on Chrome/Android/Safari; long utterances are cut after ~15 s by
     Chrome's online voices; engines sometimes get stuck in "speaking"; iOS wants the first speak inside a tap;
   - Hebrew without nikud is ambiguous, so the vocalised form is what gets spoken whenever the page has one. */
(function(W){'use strict';
if(W.Say&&W.Say.speak)return;
var D=W.document,KEY='annabelle-say',LANGS=['he','fr','en'];
var UA=(W.navigator&&W.navigator.userAgent)||'';
var IS_ANDROID=/Android/i.test(UA);
var IS_IOS=/iPad|iPhone|iPod/.test(UA)||(/Macintosh/.test(UA)&&W.navigator&&W.navigator.maxTouchPoints>1);
var IS_SAFARI=IS_IOS||(/Safari/.test(UA)&&!/Chrom(e|ium)|Edg|OPR|Android/.test(UA));
function setT(f,ms){return W.setTimeout(f,ms)}
function clrT(t){if(t)W.clearTimeout(t)}
function now(){try{if(W.performance&&W.performance.now)return W.performance.now()}catch(e){}return Date.now()}
function lsGet(k){try{return W.localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{W.localStorage.setItem(k,v)}catch(e){}}
function synth(){try{return W.speechSynthesis||null}catch(e){return null}}
function hasAPI(){return !!(synth()&&W.SpeechSynthesisUtterance)}
function uiLang(){var l=lsGet('annabelle-lang');return LANGS.indexOf(l)>=0?l:'he'}
function isMuted(){return lsGet('annabelle-muted')==='1'}

/* ------------------------------------------------------------------ settings */
var PREF={v:{},speed:'normal',nikud:'auto',probe:{},hint:{}};
function loadPref(){var o=null;try{o=JSON.parse(lsGet(KEY)||'null')}catch(e){}
 var p={v:{},speed:'normal',nikud:'auto',probe:{},hint:{}};
 if(o&&typeof o==='object'&&!Array.isArray(o)){
  if(o.v&&typeof o.v==='object')LANGS.forEach(function(l){if(typeof o.v[l]==='string'&&o.v[l].length<=120)p.v[l]=o.v[l]});
  if(o.speed==='slow')p.speed='slow';
  if(o.nikud==='on'||o.nikud==='off')p.nikud=o.nikud;
  if(o.probe&&typeof o.probe==='object')LANGS.forEach(function(l){var r=o.probe[l];if(r&&typeof r==='object'&&(r.s==='ok'||r.s==='bad'))p.probe[l]={s:r.s,t:+r.t||0,g:typeof r.g==='string'?r.g.slice(0,40):''}});
  if(o.hint&&typeof o.hint==='object')LANGS.forEach(function(l){if(o.hint[l])p.hint[l]=1})}
 PREF=p}
function savePref(){lsSet(KEY,JSON.stringify(PREF))}
loadPref();

/* ------------------------------------------------------------------ voices */
var VOICES=[],settled=false,sig='';
function normTag(t){t=String(t||'').toLowerCase().replace(/_/g,'-');var p=t.split('-'),a=p[0];
 if(a==='iw'||a==='heb')a='he';else if(a==='fra'||a==='fre')a='fr';else if(a==='eng')a='en';   /* iw = the legacy code Android still reports; 3-letter codes = Firefox on Android */
 var r=p[1]&&/^[a-z]{2}$/.test(p[1])?p[1].toUpperCase():'';return{l:a,r:r}}
var NAME_RE={he:/hebrew|עברית|ivrit|hébreu|carmit|\basaf\b|\bhila\b|\bavri\b/i,fr:/french|français|francais|צרפתית/i,en:/english|anglais|אנגלית/i};
function voiceLang(v){var t=normTag(v&&v.lang);if(LANGS.indexOf(t.l)>=0)return t.l;
 if(!/^[a-z]{2,3}$/.test(t.l)){var n=String((v&&v.name)||'');for(var i=0;i<LANGS.length;i++)if(NAME_RE[LANGS[i]].test(n))return LANGS[i]}   /* no usable tag: fall back to the name */
 return t.l}
var NOVELTY=/\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph)\b/i;
var REGION={he:['IL'],fr:['FR','BE','CH','CA'],en:['US','GB','AU','IE','CA']};
function rank(v,lang){var n=String(v.name||''),s=0;
 if(/natural|neural|premium|פרימיום/i.test(n))s+=50;
 else if(/enhanced|משופר|amélioré|haute qualité/i.test(n))s+=40;
 if(/google/i.test(n))s+=30;else if(/microsoft/i.test(n))s+=25;else if(/apple|carmit|samantha|thomas|amélie|amelie|daniel|karen|moira|aurélie|aurelie|audrey/i.test(n))s+=20;
 if(/e-?speak/i.test(n))s-=60;if(/compact/i.test(n))s-=15;if(NOVELTY.test(n))s-=80;
 if(v.localService)s+=8;if(v['default'])s+=2;
 var r=normTag(v.lang).r,i=(REGION[lang]||[]).indexOf(r);if(i>=0)s+=6-i;
 return s}
function scan(){var ss=synth(),a=[];try{a=(ss&&ss.getVoices&&ss.getVoices())||[]}catch(e){a=[]}
 var list=[];for(var i=0;i<a.length;i++)if(a[i])list.push(a[i]);
 var g=list.length+':'+list.map(function(v){return (v.name||'')+'|'+(v.lang||'')}).join(',');g=list.length+'/'+hash(g);
 var changed=g!==sig;sig=g;VOICES=list;if(list.length)settled=true;return changed}
function hash(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
function voicesFor(lang){var a=VOICES.filter(function(v){return voiceLang(v)===lang});
 return a.map(function(v,i){return{v:v,s:rank(v,lang),i:i}}).sort(function(x,y){return y.s-x.s||x.i-y.i}).map(function(x){return x.v})}
function pickVoice(lang){var a=voicesFor(lang);if(!a.length)return null;var want=PREF.v[lang];
 if(want)for(var i=0;i<a.length;i++)if(a[i].name===want)return a[i];return a[0]}
/* Does the engine speak this language?  'ok'/'bad' are remembered results of real attempts (see probe below). */
function probeState(lang){var r=PREF.probe[lang];if(!r)return '';
 if(r.s==='bad'&&(r.g!==sig||Date.now()-r.t>3*864e5))return '';   /* voice list changed or 3 days passed: try again */
 return r.s}
function can(lang){lang=LANGS.indexOf(lang)>=0?lang:uiLang();if(!hasAPI())return false;
 if(probeState(lang)==='bad')return false;
 if(pickVoice(lang))return true;
 if(!VOICES.length)return true;        /* nothing listed (yet, or ever on some Android builds): the engine may still speak */
 if(IS_ANDROID)return true;            /* Android lists languages, not installed voices: only a real attempt can tell */
 return probeState(lang)==='ok'}
var subs=[];
function emit(){subs.slice().forEach(function(f){try{f()}catch(e){}})}
function rescan(){if(scan())emit()}

/* ------------------------------------------------------------------ text preparation */
var P='\uE000';                                   /* internal "hard pause" marker (blank to fill, ellipsis) */
var HEB=/[א-ת]/,NIK=/[\u05B0-\u05BC\u05C1\u05C2\u05C7]/,NIKg=/[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
var VOWEL=/[\u05B0-\u05BB\u05C7]/;
var CCC={0x5B0:10,0x5B1:11,0x5B2:12,0x5B3:13,0x5B4:14,0x5B5:15,0x5B6:16,0x5B7:17,0x5B8:18,0x5B9:19,0x5BA:19,0x5BB:20,0x5BC:21,0x5BD:22,0x5BF:23,0x5C1:24,0x5C2:25,0x5C7:18};
/* canonical order of Hebrew points (what NFC produces): vowels, then dagesh, then shin/sin dot. Typed text is usually
   dagesh-first; engines that tokenise on exact sequences read one of the two orders badly, so we always send one order. */
function orderMarks(s,dageshFirst){return s.replace(/[\u05B0-\u05BC\u05C1\u05C2\u05C7]{2,}/g,function(m){var a=m.split('');
 a.sort(function(x,y){var cx=CCC[x.charCodeAt(0)]||0,cy=CCC[y.charCodeAt(0)]||0;if(dageshFirst){cx=cx>=24?1:cx===21?2:cx;cy=cy>=24?1:cy===21?2:cy}return cx-cy});
 var o='';for(var i=0;i<a.length;i++)if(i===0||a[i]!==a[i-1])o+=a[i];return o})}
var EMO=/[\uD83C-\uD83E][\uDC00-\uDFFF]|\uDB40[\uDC20-\uDC7F]|[\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u27BF\u2900-\u297F\u2B00-\u2BFF\u3030\u303D\u3297\u3299\u20E3\uFE00-\uFE0F]/g;
var CTRL=/[\u00AD\u034F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
function clean(s){s=String(s==null?'':s);
 s=s.replace(/[\uFB1D-\uFB4F]/g,function(c){try{return c.normalize('NFKC')}catch(e){return c}});   /* presentation forms (shin+dot as one code point, wide letters, ligatures) */
 s=s.replace(CTRL,'');
 s=s.replace(/[\u0591-\u05AF\u05BD\u05BF\u05C4\u05C5\u05C6]/g,'');    /* cantillation, meteg, rafe, upper/lower dots */
 s=s.replace(/\u05C0/g,' ').replace(/\u05C3/g,'.');                    /* paseq, sof pasuq */
 s=s.replace(/\u05C7/g,'\u05B8').replace(/\u05BA/g,'\u05B9');          /* qamats qatan / holam haser for vav: rare code points some engines skip */
 s=s.replace(/[\u2190-\u21FF\u27A1\u2794-\u27BE\u2B05-\u2B07]/g,' , ').replace(EMO,' ');   /* arrows = a short pause; emoji are never read */
 s=s.replace(/_+/g,' '+P+' ').replace(/\u2026|\.{3,}/g,' '+P+' ');     /* blanks and ellipses are pauses, never "underscore" */
 s=s.replace(/[\u05F3\u2018\u2019\u201A\u2032`\u00B4]/g,"'").replace(/[\u05F4\u201C\u201D\u201E\u2033\u00AB\u00BB]/g,'"');
 s=s.replace(/^[\u2013\u2014\u2015-]+$/,',').replace(/[\u2013\u2014\u2015]/g,' , ');   /* a dash between words = a short pause */
 return s.replace(/ +/g,' ').trim()}
function split(text){return String(text==null?'':text).replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000\t\r\n]+/g,' ').split(' ').filter(function(x){return x!==''})}
/* Hebrew letter names (final letters too), fully vocalised */
var LN={'א':'אָלֶף','ב':'בֵּית','ג':'גִּימֶל','ד':'דָּלֶת','ה':'הֵא','ו':'וָו','ז':'זַיִן','ח':'חֵית','ט':'טֵית','י':'יוֹד','כ':'כַּף','ל':'לָמֶד','מ':'מֵם','נ':'נוּן','ס':'סָמֶךְ','ע':'עַיִן','פ':'פֵּא','צ':'צָדִי','ק':'קוֹף','ר':'רֵישׁ','ש':'שִׁין','ת':'תָּו',
 'ך':'כָף סוֹפִית','ם':'מֵם סוֹפִית','ן':'נוּן סוֹפִית','ף':'פֵא סוֹפִית','ץ':'צָדִי סוֹפִית'};
function letterName(ch){ch=String(ch||'').replace(NIKg,'');return LN[ch]||''}
/* numbers 0..9999 in the feminine counting form, vocalised */
var N1=['אֶפֶס','אַחַת','שְׁתַּיִם','שָׁלוֹשׁ','אַרְבַּע','חָמֵשׁ','שֵׁשׁ','שֶׁבַע','שְׁמוֹנֶה','תֵּשַׁע','עֶשֶׂר'];
var N11=['','אַחַת עֶשְׂרֵה','שְׁתֵּים עֶשְׂרֵה','שְׁלוֹשׁ עֶשְׂרֵה','אַרְבַּע עֶשְׂרֵה','חֲמֵשׁ עֶשְׂרֵה','שֵׁשׁ עֶשְׂרֵה','שְׁבַע עֶשְׂרֵה','שְׁמוֹנֶה עֶשְׂרֵה','תְּשַׁע עֶשְׂרֵה'];
var N10=['','','עֶשְׂרִים','שְׁלוֹשִׁים','אַרְבָּעִים','חֲמִשִּׁים','שִׁשִּׁים','שִׁבְעִים','שְׁמוֹנִים','תִּשְׁעִים'];
var N100=['','מֵאָה','מָאתַיִם','שְׁלוֹשׁ מֵאוֹת','אַרְבַּע מֵאוֹת','חֲמֵשׁ מֵאוֹת','שֵׁשׁ מֵאוֹת','שְׁבַע מֵאוֹת','שְׁמוֹנֶה מֵאוֹת','תְּשַׁע מֵאוֹת'];
var N1000=['','אֶלֶף','אַלְפַּיִם','שְׁלוֹשֶׁת אֲלָפִים','אַרְבַּעַת אֲלָפִים','חֲמֵשֶׁת אֲלָפִים','שֵׁשֶׁת אֲלָפִים','שִׁבְעַת אֲלָפִים','שְׁמוֹנַת אֲלָפִים','תִּשְׁעַת אֲלָפִים'];
function vav(w){var m=w.match(/^([א-ת])([\u05B0-\u05BC\u05C1\u05C2]*)/),marks=m?m[2]:'';   /* "and": vu before a shva or a lip letter, va before hataf-patah, else ve */
 var nd=w.replace(/^([א-ת][\u05B0-\u05BB\u05C1\u05C2]*)\u05BC/,'$1');                        /* the dagesh kal drops after the prefix */
 if(/\u05B2/.test(marks))return 'וַ'+nd;
 if(/\u05B0/.test(marks)||(m&&'במפ'.indexOf(m[1])>=0))return 'וּ'+nd;
 return 'וְ'+nd}
function heNumber(n){n=Math.floor(+n);if(!(n>=0&&n<=9999))return '';if(n<=10)return N1[n];
 var parts=[],th=Math.floor(n/1000),h=Math.floor(n%1000/100),r=n%100;
 if(th)parts.push(N1000[th]);if(h)parts.push(N100[h]);
 if(r>=11&&r<=19)parts.push(N11[r-10]);else{if(r>=20||r===10)parts.push(r===10?N1[10]:N10[Math.floor(r/10)]);if(r%10&&r!==10)parts.push(N1[r%10])}
 if(parts.length>1)parts[parts.length-1]=vav(parts[parts.length-1]);
 return parts.join(' ')}
var SYM={he:{'+':'וְעוֹד','-':'פָּחוֹת','−':'פָּחוֹת','×':'כָּפוּל','*':'כָּפוּל','÷':'חֶלְקֵי','/':'חֶלְקֵי',':':'','=':'שָׁוֶה','%':'אֲחוּזִים','&':'וְגַם','<':'קָטָן מִ','>':'גָּדוֹל מִ','.':'נְקֻדָּה','to':'עַד'},
 fr:{'+':'plus','-':'moins','−':'moins','×':'fois','*':'fois','÷':'divisé par','/':'sur',':':'','=':'égale','%':'pour cent','&':'et','<':'plus petit que','>':'plus grand que','.':'virgule','to':'à'},
 en:{'+':'plus','-':'minus','−':'minus','×':'times','*':'times','÷':'divided by','/':'over',':':'','=':'equals','%':'percent','&':'and','<':'is less than','>':'is greater than','.':'point','to':'to'}};
/* full spelling for the "plain" mode: stripping nikud leaves the short spelling (דב, שלחן), which engines misread */
var MALE_KEEP={};
function clusters(w){var o=[],m;var re=/([א-ת])([\u05B0-\u05BC\u05C1\u05C2\u05C7]*)/g;while((m=re.exec(w)))o.push([m[1],m[2]]);return o}
['הִנֵּה','מִשָּׁם','מִכָּאן','מִפֹּה','מִזֶּה','מִכָּל','מִמֶּנִּי','מִמֶּנּוּ','מִמֶּנָּה','אִמָּא','אִשָּׁה','אִתָּהּ','אִתּוֹ','מִמָּה','מִמִּי'].forEach(function(w){MALE_KEEP[orderMarks(w)]=1});
var PRE='הבלכושמ';
function preOnly(c,i){if(i>2)return false;for(var k=0;k<i;k++)if(PRE.indexOf(c[k][0])<0)return false;return true}
/* heuristic "full spelling" (ktiv male) of one vocalised word; used only when the page has no plain form of its own */
function male(w){if(!NIK.test(w))return w;
 if(/['"]/.test(w))return w.split(/(['"])/).map(function(x){return x==="'"||x==='"'?x:male(x)}).join('');
 w=orderMarks(w);var keep=MALE_KEEP[w]===1,c=clusters(w),n=c.length,o='';
 var dual=n>=4&&/\u05B7\u05D9\u05B4\u05DD$/.test(w.replace(/\u05BC/g,''))&&!(c[n-3][0]==='מ'&&preOnly(c,n-3)&&(/\u05BC/.test(c[n-3][1])||c[0][0]==='ו'));   /* not prefix + mayim */
 for(var i=0;i<n;i++){var L=c[i][0],m=c[i][1],nx=c[i+1],pv=c[i-1];
  if(L==='ו'&&i>0&&i<n-1&&/[\u05B0-\u05B8\u05BB]/.test(m)&&pv[0]!=='ו'&&nx[0]!=='ו'){o+='וו';continue}                    /* consonant vav inside a word: barvaz gets two vavs */
  if(L==='י'&&dual&&i===n-2){o+='יי';continue}                                                                             /* dual ending -ayim: two yods */
  if(L==='י'&&i===n-2&&/\u05BC/.test(m)&&/\u05B8/.test(m)&&nx[0]==='ה'&&pv&&/\u05B4/.test(pv[1])){o+='יי';continue}       /* ending -iya: two yods */
  if(L==='י'&&i>0&&i<n-1&&/[\u05B5-\u05B8]/.test(m)&&nx[0]!=='ו'&&nx[0]!=='י'&&pv[0]!=='י'&&!(i===n-2&&nx[0]==='ה')&&!preOnly(c,i)){o+='יי';continue}   /* consonant yod inside a word: tsiyer, tayas */
  o+=L;
  if(/[\u05BB\u05B3]/.test(m))o+='ו';                                                                                    /* qubuts / hataf-qamats get a vav */
  else if(/\u05B9/.test(m)&&L!=='ו'){                                                                                     /* holam on a consonant gets a vav, except before a silent alef (lo, rosh) or a final he (po) */
   var qa=nx&&nx[0]==='א'&&!VOWEL.test(nx[1])&&(i<n-2||(L==='ל'&&preOnly(c,i))),fh=nx&&nx[0]==='ה'&&i===n-2&&!VOWEL.test(nx[1]);
   if(nx&&nx[0]!=='ו'&&!qa&&!fh)o+='ו'}
  else if(/\u05B4/.test(m)&&!keep&&L!=='ה'&&nx&&nx[0]!=='י'&&nx[0]!=='ו'&&/\u05BC/.test(nx[1])&&!(i===0&&L==='מ'&&n>3))o+='י'}   /* hiriq before a doubled letter gets a yod (mita); not the prefixes mi- and hi- */
 return o}
/* a single vocalised open syllable (בָּ, מִ) is read as a syllable when it gets its silent vowel letter */
function sylPad(tok){var c=clusters(tok);if(c.length!==1)return tok;var m=c[0][1],L=c[0][0];
 if(/[\u05B7\u05B8\u05B2]/.test(m))return tok+'א';if(/[\u05B5\u05B6\u05B1]/.test(m))return tok+'ה';if(/\u05B4/.test(m))return tok+'י';
 if(/\u05B9/.test(m))return L+m.replace(/\u05B9/,'')+'וֹ';if(/\u05BB/.test(m))return L+m.replace(/\u05BB/,'')+'וּ';if(/\u05B0/.test(m))return L+m.replace(/\u05B0/,'\u05B6')+'ה';return tok}
/* known mispronunciations -> respelled forms. Keys are compared without nikud. Starter list = abbreviations and tokens
   that engines spell out; real mispronunciations get added from the owner's device reports (saytest.html). */
var FIX={he:{both:{"וכו'":'וְכוּלֵי','ש"ח':'שְׁקָלִים','ק"מ':'קִילוֹמֶטֶר','ס"מ':'סֶנְטִימֶטֶר','ק"ג':'קִילוֹגְרַם',"מס'":'מִסְפָּר',"עמ'":'עַמּוּד',"גב'":'גְּבֶרֶת','ד"ר':'דּוֹקְטוֹר','חז"ל':'חֲזַל'},nikud:{},plain:{}},
 fr:{both:{'M.':'monsieur','Mme':'madame','Mlle':'mademoiselle','etc.':'et cetera','km':'kilomètres','cm':'centimètres','kg':'kilogrammes','n°':'numéro'},nikud:{},plain:{}},
 en:{both:{'Mr.':'mister','Mrs.':'missus','Dr.':'doctor','etc.':'et cetera','km':'kilometers','cm':'centimeters','kg':'kilograms','vs.':'versus'},nikud:{},plain:{}}};
function fix(lang,map,mode){if(!FIX[lang]||!map||typeof map!=='object')return;var t=FIX[lang][mode==='nikud'||mode==='plain'?mode:'both'];
 for(var k in map)if(Object.prototype.hasOwnProperty.call(map,k)){var key=String(k).replace(NIKg,'');if(map[k]==null)delete t[key];else t[key]=String(map[k])}}
function fixed(lang,tok,useNik){var F=FIX[lang],k=tok.replace(NIKg,'');if(lang!=='he')k=tok;
 var own=Object.prototype.hasOwnProperty,m=useNik?F.nikud:F.plain;
 if(own.call(m,k))return m[k];if(own.call(F.both,k))return F.both[k];
 if(lang!=='he'){var lk=k.toLowerCase();if(own.call(F.both,lk))return F.both[lk]}return null}
/* which engines should NOT get nikud. Nothing is listed on purpose: no public report shows a current system Hebrew voice
   that reads vocalised text worse than plain text, and plain Hebrew is ambiguous by nature. The table is the hook for
   what the device reports (tts_bad / saytest.html) turn up; the settings sheet overrides it per device. */
var ENGINE=[/* {re:/voice name/i, nikud:false, order:'dagesh-first'} */];
function engineFor(v){var n=String((v&&v.name)||'');for(var i=0;i<ENGINE.length;i++)if(ENGINE[i].re.test(n))return ENGINE[i];return null}
function nikudOn(v){if(PREF.nikud==='on')return true;if(PREF.nikud==='off')return false;var e=engineFor(v);return !(e&&e.nikud===false)}

var PFX={'ו':'','ב':'בְּ','ל':'לְ','מ':'מִ','כ':'כְּ','ה':'הַ','ש':'שֶׁ'};
var MATHONLY=/^[\d.,+\-\u2212\u00D7\u00F7*\/=%:<>]+$/;
function numWord(lang,s){if(lang!=='he')return s;var m=s.match(/^(\d+)(?:([.,])(\d+))?$/);if(!m)return s;
 if(m[2]===','&&m[3].length===3){var big=heNumber(m[1]+m[3]);return big||s}
 var a=heNumber(m[1]);if(!a)return s;
 if(m[3]){var d=m[3].split('').map(function(x){return N1[+x]}).join(' ');return a+' '+SYM.he['.']+' '+d}return a}
function mathTok(lang,tok,ctx){if(lang==='he'&&tok==='1%')return 'אָחוּז אֶחָד';var parts=tok.match(/\d+(?:[.,]\d+)?|[^\d]/g)||[],o=[],S=SYM[lang];
 for(var i=0;i<parts.length;i++){var p=parts[i];
  if(/\d/.test(p)){o.push(numWord(lang,p));continue}
  if(p==='-'&&!ctx.eq&&i>0&&i<parts.length-1){o.push(S.to);continue}     /* 3-5 without "=" is a range */
  if(p===':'||p==='.'||p===',')continue;
  if(S[p]!=null)o.push(S[p])}
 return o.join(' ')}
function prepTok(tok,lang,ctx){
 if(tok===P)return P;if(tok===',')return ',';
 var lead='',trail='',m,f;
 if(lang!=='he')tok=tok.replace(/[\u00B7\u2022](e|es|ne|nes|trice|trices|euse|euses|s)(?![a-z\u00C0-\u024F])/gi,'').replace(/\((e|s|es|ne)\)/gi,'');   /* French inclusive forms: ami·e, prêt(e) */
 if((m=tok.match(/^[("'\[{]+/))){if(/[(\[{]/.test(m[0]))lead=', ';tok=tok.slice(m[0].length)}
 if((f=fixed(lang,tok,ctx.nik))==null&&(m=tok.match(/[.,!?:;]+$/))&&(f=fixed(lang,tok.slice(0,-m[0].length),ctx.nik))!=null)trail=m[0].charAt(0);
 if(f==null){if((m=tok.match(/[)"'\]}.,!?:;]+$/))){var pm=m[0].replace(/[^.,!?:;]/g,'');trail=pm?pm.charAt(0):(/[)\]}]/.test(m[0])?',':'');tok=tok.slice(0,-m[0].length)}
  if(!tok)return trail;
  f=prepCore(tok,lang,ctx)}
 if(lang==='he'&&!ctx.nik)f=f.replace(NIKg,'');
 return f?lead+f+trail:''}
function prepCore(tok,lang,ctx){var S=SYM[lang];
 if(MATHONLY.test(tok)){
  if(/\d/.test(tok))return lang==='he'||/[+−×÷=*<>%]/.test(tok)?mathTok(lang,tok,ctx):tok;
  return ctx.math&&tok.length===1&&S[tok]?S[tok]:''}
 if(tok==='&')return S['&'];
 return lang==='he'?heTok(tok,ctx):latTok(tok,lang,ctx)}
function heTok(tok,ctx){var i,parts;
 if(/[־\-]/.test(tok)&&HEB.test(tok)){parts=tok.split(/[־\-]+/).filter(Boolean);
  if(parts.length===2&&/^\d/.test(parts[1])&&PFX[parts[0].replace(NIKg,'')]!=null){var num=prepCore(parts[1],'he',ctx),px=PFX[parts[0].replace(NIKg,'')];   /* prefix letter + number: "and 50", "in 3" */
   if(px&&/^[\u05D0-\u05EA][\u05C1\u05C2\u05BC]*\u05B0/.test(num))px=px.replace(/\u05B0$/,'\u05B4');   /* two shvas in a row: the prefix takes hiriq */
   return px===''?vav(num):px+num.replace(/^([א-ת][\u05B0-\u05BB\u05C1\u05C2]*)\u05BC/,'$1')}
  if(parts.length>1)return parts.map(function(p){return heTok(p,ctx)}).filter(Boolean).join(' ')}   /* maqaf / hyphen */
 if(tok.indexOf('/')>=0&&HEB.test(tok)){parts=tok.split('/').filter(Boolean);if(parts.length>1){var a=parts[0],b=parts[1],bl=b.replace(NIKg,'').length,al=a.replace(NIKg,'').length;
   if(bl<=2||bl<al-1||!HEB.test(b))return heTok(a,ctx);                                          /* את/ה, ילד/ה: say the base form */
   return parts.map(function(p){return heTok(p,ctx)}).filter(Boolean).join(ctx.nik?' אוֹ ':' או ')}}
 if(!HEB.test(tok)){
  if(/^[A-Za-zÀ-ɏ'’.\-]+$/.test(tok))return ctx.latin==='keep'?tok:'';
  if(/\d/.test(tok)){return tok.replace(/\d+/g,function(d){return ' '+(heNumber(d)||d)+' '}).replace(/[^א-ת\u05B0-\u05C7 \d]/g,' ').replace(/ +/g,' ').trim()}
  return ''}
 tok=tok.replace(/[A-Za-zÀ-ɏ]+/g,ctx.latin==='keep'?' $& ':' ').replace(/\d+/g,function(d){return ' '+(heNumber(d)||d)+' '}).trim();
 if(tok.indexOf(' ')>=0)return tok.split(/ +/).map(function(p){return HEB.test(p)?heTok(p,ctx):p}).join(' ');
 tok=tok.replace(/^['"]+/,'');
 tok=tok.replace(/'/g,function(q,ix){var prev=tok.slice(0,ix).replace(NIKg,'').slice(-1);return 'גזצתדח'.indexOf(prev)>=0?"'":''});   /* geresh only where it changes the sound */
 tok=tok.replace(/"(?![א-ת][\u05B0-\u05C7]*$)/g,'').replace(/^"/,'');   /* gershayim before the last letter = acronym, otherwise a quote */
 var bare=tok.replace(NIKg,'').replace(/['"]/g,'');
 if(bare.length===1&&LN[bare]){
  if(VOWEL.test(tok)&&ctx.kind!=='letter'){tok=sylPad(tok)}
  else{var nm=LN[bare];return ctx.nik?nm:nm.replace(NIKg,'')}}
 if(!ctx.nik)tok=male(tok).replace(NIKg,'');
 return tok}
function latTok(tok,lang,ctx){
 tok=tok.replace(/[א-ת\u05B0-\u05C7־]+/g,'');if(!tok)return '';
 if(tok.indexOf('/')>=0&&/[A-Za-zÀ-ɏ]/.test(tok)){var p=tok.split('/').filter(Boolean);if(p.length>1){if(p[1].length<=2&&p[0].length>p[1].length)return p[0];return p.join(lang==='fr'?' ou ':' or ')}}
 if(ctx.kind==='letter'&&/^[A-Za-zÀ-ɏ]$/.test(tok))return tok.toUpperCase();      /* "A", not the article "a" */
 return tok.replace(/[<>{}\[\]|\\^~#@*]+/g,' ').trim()}
function tidy(s){return s.replace(/\s+/g,' ').replace(/ ([.,!?:;])/g,'$1').replace(/,(?=[.!?:;,])/g,'').replace(/([.!?:;])\1+/g,'$1').replace(/^[\s,;:.]+/,'').replace(/[\s,]+$/,'').trim()}
/* returns one spoken piece per whitespace-separated word of the source text, so pieces map back to the words on screen.
   A piece may be '' (emoji, stray symbols) or contain the pause marker. */
function pieces(text,o){o=o||{};var lang=LANGS.indexOf(o.lang)>=0?o.lang:uiLang();
 var nik=lang==='he'&&(o.nikud===true||o.nikud===false?o.nikud:nikudOn(o.voice||null));
 var raw=split(text),all=raw.join(' ');
 var ctx={nik:nik,kind:o.kind||'',latin:o.latin||(o.kind&&o.kind!=='ui'?'drop':'keep'),eq:/=/.test(all),math:/\d/.test(all)};
 return raw.map(function(r){var p=clean(r).split(' ').map(function(t){return t===''?'':prepTok(t,lang,ctx)}).filter(function(x){return x!==''}).join(' ');
  if(lang==='he')p=orderMarks(p,o.order==='dagesh-first');
  if(o.order!=='dagesh-first')try{p=p.normalize('NFC')}catch(e){}
  return p.replace(/ ,/g,',')})}
function prep(text,o){var a=pieces(text,o).filter(function(x){return x!==''});return tidy(a.join(' ').replace(new RegExp('\\s*'+P+'\\s*','g'),', '))}

/* ------------------------------------------------------------------ speaking */
var stats={spoken:0,chunks:0,stuck:0,retries:0,fast:0,errors:0,last:null,log:[]};
var cur=null,seq=0,keep=[],gestured=false,primedAt=-1e9,fastRun={},hintShown={};
var BASE={he:.85,fr:.9,en:.9},LEVELF=[.82,.9,1,1.05];
function rateFor(lang,o){var r=BASE[lang]||.9,L=Math.round(+o.level);if(L>=1&&L<=4)r*=LEVELF[L-1];
 if(o.kind==='letter'||o.kind==='syl')r=Math.min(r,.8);if(PREF.speed==='slow')r*=.82;if(o.slow)r*=.7;if(+o.rate>0)r*=+o.rate;
 return Math.max(.5,Math.min(1.3,Math.round(r*100)/100))}
function tagFor(lang,v){var t=v?normTag(v.lang):null;if(t&&t.l===lang&&t.r)return lang+'-'+t.r;return lang==='he'?'he-IL':lang==='fr'?'fr-FR':'en-US'}
function buildChunks(src,o,rate){var pc=pieces(src,o),chunks=[],c=null,max=Math.max(50,Math.min(140,Math.round(120*rate)));   /* short chunks: Chrome's online voices die after ~15 s */
 function close(gap){if(c&&c.parts.length){c.gap=gap;c.text=tidy(c.parts.join(' '));if(c.text&&/[^\s.,!?:;]/.test(c.text)){chunks.push(c);c=null;return}}
  if(chunks.length&&gap>chunks[chunks.length-1].gap)chunks[chunks.length-1].gap=gap;c=null}
 for(var i=0;i<pc.length;i++){var segs=pc[i].split(P);
  for(var k=0;k<segs.length;k++){var p=segs[k].trim();
   if(k>0)close(o.slow?750:520);                         /* a blank to fill / an ellipsis = a real pause */
   if(p===''||p===','){if(p===','&&c&&c.parts.length)c.parts[c.parts.length-1]+=',';continue}
   if(!c)c={parts:[],w0:i,w1:i,map:[],len:0,gap:0};
   c.map.push({c:c.len,w:i});c.parts.push(p);c.len+=p.length+1;c.w1=i;
   if(o.words){if(k===segs.length-1)close(o.slow?520:340);continue}
   if(/[.!?]$/.test(p))close(o.kind==='story'?(o.slow?520:300):220);
   else if(c.len>=max&&/[,;:]$/.test(p))close(120);
   else if(c.len>=max*1.5)close(60)}}
 close(0);return{chunks:chunks,n:pc.length}}
function speak(text,o){o=o||{};var lang=LANGS.indexOf(o.lang)>=0?o.lang:uiLang();
 if(!hasAPI())return fail(lang,o);
 if(o.auto&&(isMuted()||!gestured))return false;                  /* automatic speech never talks over a muted page or before a tap */
 if(D&&D.hidden)return false;
 var v=pickVoice(lang),nik=lang==='he'&&(o.mode==='nikud'?true:o.mode==='plain'?false:nikudOn(v)),e=engineFor(v);
 if(!v&&VOICES.length&&!IS_ANDROID&&probeState(lang)!=='ok')return fail(lang,o);   /* a reliable voice list without this language: speaking would use a foreign voice */
 var src=text;if(lang==='he'){if(nik&&o.nikud)src=o.nikud;else if(!nik&&o.plain)src=o.plain}
 if(src==null||String(src).trim()==='')return false;
 var rate=rateFor(lang,o);
 var b=buildChunks(src,{lang:lang,nikud:nik,kind:o.kind,latin:o.latin,voice:v,order:e&&e.order,words:!!o.words,slow:!!o.slow},rate);
 if(!b.chunks.length)return false;
 var ss=synth(),busy=!!cur;try{busy=busy||((ss.speaking||ss.pending)&&now()-primedAt>1500)}catch(er){}
 halt(true);                                                        /* the interrupted request hears onend(false) */
 var S=cur={id:++seq,lang:lang,voice:v,rate:rate,pitch:+o.pitch>0?+o.pitch:1,chunks:b.chunks,i:0,o:o,explicit:!o.auto,len:String(src).length,ok:0,tries:0,started:false,t:0};
 stats.spoken++;stats.last={lang:lang,voice:v?String(v.name||''):'',len:S.len,nikud:nik,rate:rate,slow:!!o.slow};
 if(busy){try{ss.cancel()}catch(er){}}
 try{if(ss.paused)ss.resume()}catch(er){}
 var wait=(busy?(IS_ANDROID?160:90):0)+(+o.delay>0?+o.delay:0);   /* cancel() + immediate speak() is dropped by Chrome/Android/Safari */
 if(wait)S.t=setT(function(){S.t=0;next(S)},wait);else next(S);
 return true}
function fail(lang,o){if(o&&!o.auto)hint(lang,{reason:'novoice'});if(o&&o.onend)try{o.onend(false)}catch(e){}return false}
function halt(fire){var S=cur;cur=null;if(!S)return;clrT(S.t);clrT(S.w);S.t=S.w=0;if(S.u){S.u.onstart=S.u.onend=S.u.onerror=S.u.onboundary=null;S.u=null}
 if(S.o.onword)try{S.o.onword(-1,-1)}catch(e){}
 if(fire!==false&&S.o.onend)try{S.o.onend(false)}catch(e){}}
function stop(){var had=!!cur;halt(true);var ss=synth();try{if(ss&&(had||ss.speaking||ss.pending))ss.cancel()}catch(e){}keep.length=0}
function busyNow(){return !!cur}
function done(S,ok){if(cur!==S)return;cur=null;clrT(S.t);clrT(S.w);keep.length=0;
 if(S.o.onword)try{S.o.onword(-1,-1)}catch(e){}
 if(S.o.onend)try{S.o.onend(!!ok)}catch(e){}}
function probe(lang,good){var was=can(lang);
 if(good){fastRun[lang]=0;if(probeState(lang)!=='ok'){PREF.probe[lang]={s:'ok',t:Date.now(),g:sig};savePref()}}
 else{fastRun[lang]=(fastRun[lang]||0)+1;if(fastRun[lang]>=2){PREF.probe[lang]={s:'bad',t:Date.now(),g:sig};savePref()}}
 if(was!==can(lang))emit()}
function next(S){if(cur!==S)return;if(S.i>=S.chunks.length){done(S,S.ok>0);return}
 var ss=synth(),c=S.chunks[S.i],u;
 try{u=new W.SpeechSynthesisUtterance(c.text)}catch(e){done(S,false);return}
 if(S.voice&&!S.noVoice){try{u.voice=S.voice}catch(e){}}
 u.lang=tagFor(S.lang,S.noVoice?null:S.voice);u.rate=S.rate;u.pitch=S.pitch;u.volume=1;
 var started=false,ended=false,gotB=false,t0=now(),ts=0,letters=c.text.replace(/[^A-Za-zÀ-ɏא-ת]/g,'').length;
 function live(){return cur===S&&S.u===u&&!ended}
 function word(a,b){if(S.o.onword)try{S.o.onword(a,b)}catch(e){}}
 function fin(kind,err){if(!live())return;ended=true;clrT(S.w);S.w=0;
  var dur=now()-(ts||t0);
  if(kind==='error'){stats.errors++;
   if(err==='not-allowed'){done(S,false);return}                                  /* needs a tap first: not the engine's fault */
   if(S.voice&&!S.noVoice&&/voice-unavailable|language-unavailable|synthesis/.test(err||'')){S.noVoice=true;stats.retries++;S.t=setT(function(){S.t=0;next(S)},120);return}
   probe(S.lang,false);if(!can(S.lang)&&S.explicit)hint(S.lang,{reason:'error'});done(S,S.ok>0);return}
  if(kind==='stuck'){stats.stuck++;try{ss.cancel()}catch(e){}}
  else if(!gotB&&letters>=1&&dur<60){stats.fast++;probe(S.lang,false);                /* "finished" instantly: the engine has no voice for this language */
   if(!can(S.lang)){if(S.explicit)hint(S.lang,{reason:'silent'});done(S,false);return}}
  else{S.ok++;probe(S.lang,true)}
  stats.chunks++;S.i++;S.tries=0;
  var gap=c.gap+(kind==='stuck'?200:0);if(S.i<S.chunks.length&&gap>0)S.t=setT(function(){S.t=0;next(S)},gap);else next(S)}
 u.onstart=function(){if(!live())return;started=true;ts=now();clrT(S.w);
  if(!S.started){S.started=true;if(S.o.onstart)try{S.o.onstart()}catch(e){}}
  word(c.w0,c.w1);
  S.w=setT(function(){S.w=0;fin('stuck')},2500+c.text.length*150/S.rate)};      /* no "end" long after it should have finished */
 u.onboundary=function(ev){if(!live()||(ev&&ev.name&&ev.name!=='word'))return;var ci=ev?+ev.charIndex:NaN;if(!(ci>=0))return;gotB=true;
  var w=c.map[0].w;for(var k=0;k<c.map.length;k++){if(c.map[k].c<=ci)w=c.map[k].w;else break}word(w,w)};
 u.onend=function(){fin('end')};
 u.onerror=function(ev){var err=ev&&ev.error||'';if(!live())return;if(err==='interrupted'||err==='canceled'){ended=true;done(S,S.ok>0);return}fin('error',err)};   /* someone else cancelled: stop quietly */
 S.u=u;keep.push(u);if(keep.length>40)keep.shift();        /* keep a reference: Chrome drops events of garbage-collected utterances */
 stats.log.push({text:c.text,lang:u.lang,rate:u.rate,voice:S.voice&&!S.noVoice?String(S.voice.name||''):''});if(stats.log.length>60)stats.log.shift();
 try{ss.speak(u)}catch(e){fin('error','throw');return}
 /* watchdog: no "start" → resume() once (stuck paused queue), then one clean retry, then give up */
 S.w=setT(function(){S.w=0;if(!live()||started)return;try{ss.resume()}catch(e){}
  S.w=setT(function(){S.w=0;if(!live()||started)return;ended=true;try{ss.cancel()}catch(e){}
   if(S.tries<1){S.tries++;stats.retries++;S.t=setT(function(){S.t=0;next(S)},250)}
   else{stats.stuck++;probe(S.lang,false);if(!can(S.lang)&&S.explicit)hint(S.lang,{reason:'stuck'});done(S,S.ok>0)}},2500)},4000)}

/* ------------------------------------------------------------------ environment hooks */
function prime(){gestured=true;
 if(primedAt>-1e8||!IS_SAFARI||!hasAPI())return;primedAt=now();       /* iOS/Safari: the first speak() must happen inside a tap */
 if(cur)return;try{var u=new W.SpeechSynthesisUtterance(' ');u.volume=0;u.lang=tagFor(uiLang(),null);synth().speak(u)}catch(e){}}
function hook(){var ss=synth();
 try{if(ss&&ss.addEventListener)ss.addEventListener('voiceschanged',rescan);else if(ss)ss.onvoiceschanged=rescan}catch(e){}
 scan();
 [250,1000,2500,6000].forEach(function(ms){setT(function(){rescan();if(ms>=2500&&!settled){settled=true;emit()}},ms)});   /* some builds never fire voiceschanged */
 if(!D||!D.addEventListener)return;
 ['pointerdown','touchend','keydown','click'].forEach(function(ev){D.addEventListener(ev,prime,true)});
 D.addEventListener('visibilitychange',function(){if(D.hidden)stop();else rescan()});
 if(W.addEventListener){W.addEventListener('pagehide',stop);W.addEventListener('pageshow',rescan)}}

/* ------------------------------------------------------------------ UI: hint + settings sheet */
var UI={
 he:{title:'קול ההקראה',voice:'קול',auto:'אוטומטי',test:'בדיקה',none:'לא נמצא קול בשפה הזאת במכשיר',how:'איך מוסיפים קול?',speed:'מהירות',normal:'רגילה',slow:'איטית',nikud:'ניקוד בהקראה',nAuto:'אוטומטי',nOn:'עם ניקוד',nOff:'בלי ניקוד',
  bad:'זה נשמע לא נכון',thanks:'תודה! קיבלנו.',check:'בדיקת קול מלאה',close:'סגירה',names:{he:'עברית',fr:'צרפתית',en:'אנגלית'},
  hT:'אין קול בעברית במכשיר',hF:'אין קול בצרפתית במכשיר',hE:'אין קול באנגלית במכשיר',hSub:'בלי קול מותקן אי אפשר להקריא. מוסיפים פעם אחת וזה עובד:',ok:'הבנתי',
  and:['קודם כול: להגביר את עוצמת המדיה.','הגדרות ← ניהול כללי (או: מערכת ← שפות) ← פלט טקסט לדיבור.','מנוע מועדף: "זיהוי דיבור וסינתזה מ-Google" (במנוע של Samsung בדרך כלל אין עברית).','גלגל השיניים ← התקנת נתוני קול ← עברית (ישראל) ← הורדה.','לסגור את המשחק ולפתוח שוב.'],
  ios:['קודם כול: לבטל מצב שקט (המתג בצד) ולהגביר עוצמה.','הגדרות ← נגישות ← הקראת תוכן ← קולות ← עברית.','לבחור "כרמית" ולהוריד את הגרסה המשופרת.','לסגור את המשחק ולפתוח שוב.'],
  pc:['Windows: הגדרות ← זמן ושפה ← שפה ← הוספת עברית עם "דיבור".','או לפתוח את האתר בדפדפן Edge – יש בו קולות עבריים מוכנים.','Mac: הגדרות מערכת ← נגישות ← תוכן מוקרא ← קול מערכת ← עברית (כרמית).']},
 fr:{title:'Voix de lecture',voice:'Voix',auto:'Automatique',test:'Tester',none:'Aucune voix trouvée pour cette langue',how:'Comment ajouter une voix ?',speed:'Vitesse',normal:'Normale',slow:'Lente',nikud:'Voyelles hébraïques (nikoud)',nAuto:'Automatique',nOn:'Avec',nOff:'Sans',
  bad:'Ça sonnait faux',thanks:'Merci, c’est noté !',check:'Test complet de la voix',close:'Fermer',names:{he:'Hébreu',fr:'Français',en:'Anglais'},
  hT:'Pas de voix en hébreu sur cet appareil',hF:'Pas de voix en français sur cet appareil',hE:'Pas de voix en anglais sur cet appareil',hSub:'Sans voix installée, la lecture à voix haute est impossible. À faire une seule fois :',ok:'Compris',
  and:['D’abord : monte le volume « multimédia ».','Paramètres → Gestion globale (ou Système → Langues) → Synthèse vocale.','Moteur préféré : « Reconnaissance et synthèse vocales de Google » (le moteur Samsung n’a en général pas l’hébreu).','Roue dentée → Installer les données vocales → choisir la langue → Télécharger.','Ferme le jeu et rouvre-le.'],
  ios:['D’abord : enlève le mode silencieux (bouton sur le côté) et monte le volume.','Réglages → Accessibilité → Contenu énoncé → Voix → choisir la langue.','Choisis une voix (hébreu : « Carmit ») et télécharge la version améliorée.','Ferme le jeu et rouvre-le.'],
  pc:['Windows : Paramètres → Heure et langue → Langue → ajouter la langue avec « Synthèse vocale ».','Ou ouvre le site avec Edge : il contient déjà des voix.','Mac : Réglages Système → Accessibilité → Contenu énoncé → Voix système.']},
 en:{title:'Read-aloud voice',voice:'Voice',auto:'Automatic',test:'Test',none:'No voice found for this language on this device',how:'How to add a voice',speed:'Speed',normal:'Normal',slow:'Slow',nikud:'Hebrew vowel points (nikud)',nAuto:'Automatic',nOn:'With',nOff:'Without',
  bad:'This sounded wrong',thanks:'Thanks, noted!',check:'Full voice check',close:'Close',names:{he:'Hebrew',fr:'French',en:'English'},
  hT:'No Hebrew voice on this device',hF:'No French voice on this device',hE:'No English voice on this device',hSub:'Read-aloud needs an installed voice. Add it once and it keeps working:',ok:'Got it',
  and:['First: turn the media volume up.','Settings → General management (or System → Languages) → Text-to-speech output.','Preferred engine: "Speech Recognition & Synthesis from Google" (Samsung’s own engine usually has no Hebrew).','Gear icon → Install voice data → pick the language → Download.','Close the game and open it again.'],
  ios:['First: switch off silent mode (side switch) and turn the volume up.','Settings → Accessibility → Spoken Content → Voices → pick the language.','Choose a voice (Hebrew: "Carmit") and download the Enhanced version.','Close the game and open it again.'],
  pc:['Windows: Settings → Time & language → Language → add the language with "Speech".','Or open the site in Edge: it ships with voices.','Mac: System Settings → Accessibility → Spoken Content → System voice.']}};
var SAMPLE={he:'שָׁלוֹם! הֶחָתוּל שׁוֹתֶה חָלָב, וְהַכֶּלֶב רָץ בַּגִּנָּה.',fr:'Bonjour ! Le petit chat boit du lait dans la cuisine.',en:'Hello! The little cat is drinking milk in the kitchen.'};
var SAMPLE_PLAIN={he:'שלום! החתול שותה חלב, והכלב רץ בגינה.'};
function el(tag,cls,text){var e=D.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function css(){if(!D||D.getElementById('say-css'))return;var s=el('style');s.id='say-css';
 s.textContent='.say-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(20,24,40,.55);display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}'+
 '.say-card{background:#fffdf6;color:#23263a;border:3px solid #23263a;border-radius:18px;box-shadow:0 6px 0 rgba(35,38,58,.9);width:100%;max-width:440px;max-height:calc(100% - 4px);overflow:auto;overscroll-behavior:contain;padding:12px 14px;box-sizing:border-box;font-size:16px;line-height:1.35;text-align:start}'+
 '.say-card *{box-sizing:border-box;font-family:inherit}.say-card h2{margin:0 0 8px;font-size:20px;font-weight:900;text-align:center}.say-card h3{margin:10px 0 4px;font-size:15px;font-weight:800}'+
 '.say-row{display:flex;gap:6px;align-items:center;margin:4px 0}.say-row>label{flex:none;width:64px;font-weight:800;font-size:14px}.say-row select{flex:1;min-width:0;max-width:100%;height:44px;border:2px solid #23263a;border-radius:10px;background:#fff;color:#23263a;font-size:14px;padding:0 6px}'+
 '.say-b{min-height:44px;border:2px solid #23263a;border-radius:12px;background:#fff;color:#23263a;font-size:15px;font-weight:800;padding:6px 12px;cursor:pointer;box-shadow:0 3px 0 #23263a;touch-action:manipulation}.say-b:active{transform:translateY(2px);box-shadow:0 1px 0 #23263a}'+
 '.say-b.on{background:#ffd95a}.say-b.go{background:#8fe3a2}.say-b.wide{display:block;width:100%;margin:8px 0 0}.say-b.t{flex:none;padding:6px 10px;min-width:44px}.say-seg{display:flex;gap:6px;flex-wrap:wrap}.say-seg .say-b{flex:1}'+
 '.say-note{font-size:13px;color:#5b6078;margin:2px 0}.say-card ol{margin:6px 0;padding-inline-start:22px}.say-card li{margin:4px 0;font-size:15px}.say-link{display:block;text-align:center;margin:10px 0 2px;color:#2a5bd7;font-weight:800;font-size:15px}'+
 '@media (max-height:680px){.say-card{padding:8px 12px;font-size:15px}.say-card h2{font-size:18px;margin-bottom:4px}.say-card h3{margin:6px 0 2px}.say-b.wide{margin-top:6px}}';
 (D.head||D.documentElement).appendChild(s)}
function overlay(id){css();var old=D.getElementById(id);if(old)old.remove();var L=uiLang(),ov=el('div','say-ov'),card=el('div','say-card');
 ov.id=id;ov.setAttribute('dir',L==='he'?'rtl':'ltr');ov.setAttribute('lang',L);card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
 ov.appendChild(card);ov.addEventListener('click',function(e){if(e.target===ov)ov.remove()});
 ov.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();ov.remove()}});
 (D.body||D.documentElement).appendChild(ov);return{ov:ov,card:card,T:UI[L],L:L}}
function platform(){return IS_ANDROID?'and':IS_IOS?'ios':'pc'}
/* friendly "how to add a voice" card. {once:true} = at most one automatic showing per language, ever */
function hint(lang,o){o=o||{};lang=LANGS.indexOf(lang)>=0?lang:'he';if(!D||!D.createElement)return false;
 if(o.once){if(PREF.hint[lang])return false}                                   /* automatic: once per device and language */
 if(o.once||o.reason){PREF.hint[lang]=1;savePref()}                            /* a failed tap always explains itself: never a dead button */
 hintShown[lang]=Date.now();
 var x=overlay('say-hint'),T=x.T,c=x.card,pf=platform();
 c.appendChild(el('h2',null,'🔈 '+(lang==='he'?T.hT:lang==='fr'?T.hF:T.hE)));c.appendChild(el('p','say-note',T.hSub));
 var order=[pf].concat(['and','ios','pc'].filter(function(k){return k!==pf}));
 order.forEach(function(k,i){if(i>0&&!o.all)return;c.appendChild(el('h3',null,k==='and'?'Android':k==='ios'?'iPhone / iPad':'Windows / Mac'));var ol=el('ol');T[k].forEach(function(s){ol.appendChild(el('li',null,s))});c.appendChild(ol)});
 if(!o.all){var more=el('button','say-b wide',T.how+' (Android / iPhone / PC)');more.type='button';more.onclick=function(){x.ov.remove();hint(lang,{all:true})};c.appendChild(more)}
 var a=el('a','say-link',T.check);a.href='saytest.html';c.appendChild(a);
 var ok=el('button','say-b go wide',T.ok);ok.type='button';ok.id='say-hint-ok';ok.onclick=function(){x.ov.remove()};c.appendChild(ok);
 try{ok.focus()}catch(e){}
 try{W.KidApp&&W.KidApp.track&&W.KidApp.track('tts_hint',{lang:lang,why:String(o.reason||(o.once?'auto':'user')),voices:VOICES.length})}catch(e){}
 return true}
function report(ok,extra){var l=stats.last||{lang:uiLang(),voice:'',len:0};
 var d={lang:l.lang,voice:String(l.voice||'').slice(0,80),len:l.len|0};      /* voice name and length only: never the text */
 if(extra&&typeof extra==='object')['id','nikud','slow','mode'].forEach(function(k){if(extra[k]!=null)d[k]=typeof extra[k]==='string'?extra[k].slice(0,40):extra[k]});
 try{W.KidApp&&W.KidApp.track&&W.KidApp.track(ok?'tts_ok':'tts_bad',d)}catch(e){}return d}
function settings(){if(!D||!D.createElement)return false;rescan();var x=overlay('say-sheet'),T=x.T,c=x.card,L=x.L;
 c.appendChild(el('h2',null,'🔊 '+T.title));
 [L].concat(LANGS.filter(function(k){return k!==L})).forEach(function(lang){
  var vs=voicesFor(lang),row=el('div','say-row'),lab=el('label',null,T.names[lang]);row.setAttribute('data-lang',lang);row.appendChild(lab);
  if(vs.length){var sel=el('select');sel.id='say-v-'+lang;lab.setAttribute('for',sel.id);
   var o0=el('option',null,T.auto+' · '+String(vs[0].name||''));o0.value='';sel.appendChild(o0);
   vs.forEach(function(v){var op=el('option',null,String(v.name||'')+' · '+String(v.lang||''));op.value=String(v.name||'');if(PREF.v[lang]===op.value)op.selected=true;sel.appendChild(op)});
   sel.onchange=function(){if(sel.value)PREF.v[lang]=sel.value;else delete PREF.v[lang];savePref();emit()};row.appendChild(sel)}
  else{var b=el('button','say-b',T.how);b.type='button';b.style.flex='1';b.setAttribute('data-how',lang);b.onclick=function(){hint(lang,{all:true})};row.appendChild(b)}
  var t=el('button','say-b t','▶');t.type='button';t.setAttribute('aria-label',T.test+' '+T.names[lang]);t.setAttribute('data-test',lang);
  t.onclick=function(){delete PREF.probe[lang];fastRun[lang]=0;savePref();speak(SAMPLE[lang],{lang:lang,kind:'ui',plain:SAMPLE_PLAIN[lang]})};row.appendChild(t);
  c.appendChild(row);
  if(!vs.length)c.appendChild(el('p','say-note',T.none))});
 c.appendChild(el('h3',null,T.speed));var sg=el('div','say-seg');
 [['normal',T.normal],['slow','🐢 '+T.slow]].forEach(function(p){var b=el('button','say-b'+(PREF.speed===p[0]?' on':''),p[1]);b.type='button';b.setAttribute('data-speed',p[0]);
  b.onclick=function(){PREF.speed=p[0];savePref();[].forEach.call(sg.children,function(k){k.classList.toggle('on',k===b)});emit()};sg.appendChild(b)});c.appendChild(sg);
 c.appendChild(el('h3',null,T.nikud));var ng=el('div','say-seg');
 [['auto',T.nAuto],['on',T.nOn],['off',T.nOff]].forEach(function(p){var b=el('button','say-b'+(PREF.nikud===p[0]?' on':''),p[1]);b.type='button';b.setAttribute('data-nikud',p[0]);
  b.onclick=function(){PREF.nikud=p[0];savePref();[].forEach.call(ng.children,function(k){k.classList.toggle('on',k===b)});emit()};ng.appendChild(b)});c.appendChild(ng);
 var bad=el('button','say-b wide','👎 '+T.bad);bad.type='button';bad.id='say-bad';bad.onclick=function(){report(false);bad.textContent='✔ '+T.thanks;bad.disabled=true};c.appendChild(bad);
 var hw=el('button','say-b wide','🔈 '+T.how);hw.type='button';hw.id='say-how';hw.onclick=function(){x.ov.remove();hint(L,{all:true})};c.appendChild(hw);
 var a=el('a','say-link',T.check);a.href='saytest.html';a.id='say-check';c.appendChild(a);
 var cl=el('button','say-b go wide',T.close);cl.type='button';cl.id='say-close';cl.onclick=function(){x.ov.remove()};c.appendChild(cl);
 try{cl.focus()}catch(e){}return true}

/* ------------------------------------------------------------------ public API */
W.Say={
 can:can,speak:speak,stop:stop,busy:busyNow,settings:settings,hint:hint,prep:prep,fix:fix,report:report,
 onchange:function(cb){if(typeof cb==='function')subs.push(cb);return function(){var i=subs.indexOf(cb);if(i>=0)subs.splice(i,1)}},
 voices:function(lang){rescan();return voicesFor(LANGS.indexOf(lang)>=0?lang:uiLang()).map(function(v){return{name:String(v.name||''),lang:String(v.lang||''),local:!!v.localService,score:rank(v,voiceLang(v))}})},
 allVoices:function(){rescan();return VOICES.map(function(v){return{name:String(v.name||''),lang:String(v.lang||''),local:!!v.localService,as:voiceLang(v)}})},
 voice:function(lang){var v=pickVoice(lang);return v?{name:String(v.name||''),lang:String(v.lang||'')}:null},
 pref:function(k,val){if(arguments.length>1){if(k==='speed')PREF.speed=val==='slow'?'slow':'normal';else if(k==='nikud')PREF.nikud=val==='on'||val==='off'?val:'auto';else return null;savePref();emit()}return k==='speed'?PREF.speed:k==='nikud'?PREF.nikud:null},
 nikudOn:function(lang){return nikudOn(pickVoice(lang||'he'))},
 letterName:letterName,number:heNumber,pieces:pieces,words:split,male:male,orderMarks:orderMarks,rate:function(lang,o){return rateFor(lang,o||{})},
 state:function(lang){return{api:hasAPI(),voices:VOICES.length,settled:settled,probe:probeState(lang||uiLang()),platform:platform(),muted:isMuted()}},
 stats:stats,_reset:function(){loadPref();fastRun={};hintShown={};scan()}};
hook();
})(typeof window!=='undefined'?window:this);
