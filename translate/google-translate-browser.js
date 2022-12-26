const { generateRequestUrl, normaliseResponse } = require('google-translate-api-browser');
const axios = require('axios');
const {simplified} = require("zh-convert");
const convert = require("cyrillic-to-latin");
const {tr} = require("language-name-map/map");

// const textToTranslate = `Welcome to English in a minute.\nMost people enjoy going to parties.\nYou got to be around friends, eat food, and maybe listen to music.\nBut do your parties ever have animals?\nParty animal.\nHey Jonathan, are you as ready as I am for the weekend?\nOh yeah.\nI'm going to my brother's birthday party on Friday.\nMy cousin is having her graduation party Saturday.\nAnd I'm hosting the karaoke party on Sunday.\nWow, you are quite the party animal aren't you?\nThat's nothing. You should have seen me in college.\nA party animal is not an actual animal.\nIt is a person who really enjoys going to parties.\nMost of their time is spent finding out where the latest and best party is going to be.\nAnd that's English in a minute.\n`;
//
// const url = generateRequestUrl(textToTranslate, { to: "sr" });

// axios.get(url)
//   .then(response => {
//     console.log(normaliseResponse(response.data));
//
//     const parsedResponse = normaliseResponse(response.data);
//     const translatedText = parsedResponse.text;
//
//     let latinCharactersText = convert(translatedText);
//
//
//     console.log(latinCharactersText);
//   })
//   .catch(error => {
//     console.log(error.message);
//   });

const textToTranslate = `Znači tako.
Tako.
Vi znate šta vam sleduje?
Nemamo pojma, to ne piše nigde u pravilniku.
Od sad ćete razgovarati sa višim instansama.
Ko je idejni vođa ovog protesta?
Ja sam.
Pa, šta da kažem.
Možda i nije najpametnije što sam to uradila, ali...
Sad je gotovo.
E sad su stvarno prekardašini.
Ja sam.
Ja znam šta se događa u ovoj školi
i danju i noću.
Imamo i kamere.
Koje ne radi.
Nastavničko veće je razmotrilo vaš slučaj
i odlučili smo da vam
izađemo u slučaj.
Dešava arkoteku u meni.
A, šta?
A.
Ja.
De.
Nacija, moja generacija.
Samo dominacija, ajmo ruke gore svire.
Nacija, moja generacija.
Samo dominacija, ajmo ruke gore svi.
Ako u problemu si, znaj da u problemu svi.
Smo svaki dan i niko nije sam.
Zato, lagano.
Gledaj, vidi, slušaj.
I za mnom sreću svoju kušaj.
Sva je, vi smo ti i ja.
Čista dominacija.
U doba informacija.
Moja generacija.
Sva je, vi smo ti i ja.
Čista dominacija.
U doba informacija.
Moja generacija.
Moja generacija.
Ćao svima.
Za sada je prošlo dobro.
Živa sam, jer ukravo pišem novi post.
Stojim još na obe noge,
ali to ćete već morati da mi verujete na reč.
A sada,
da vidimo šta će se dalje desiti.
Osvano je još jedan novi dan,
u novom gradu,
u novoj školi,
sa novim društvom.
I svakome će doneti nešto lovo.
A što bi rekao Duško Radović,
svaki novi dan je nagrada
ili kazna za ono što ste juče radili.
Pa da vidimo.
Šta je bre s ovo?
Samo zavadaš ovaj kečari iz fizike.
Brate, kada je kretenka morala da me pita
na početku godine.
K'o realno pita na početku godine?
I? Šta ćeš sada?
Pa ništa, što?
Što mene nisi zval, ja bi ti objasnil sve formule.
Brate, zabole me za formule.
Ali uborit ćete.
Pusti, nije ni bitno, koga briga,
ako neću se baviti fizikom u životu.
Znam, ali...
To mi je nebitno, kapiraš?
Škola je prolazna stvar u mojom životu,
tako da ono, brate, lagano.
Moram, brate, palim na trening.
Ajde. Ajde, gledamo se.
Ćao.
I? Jesi se malo navikla na Beograd?
Pa, jes.
Mada nisam prvi put ovde, znaš,
dolazila sam i rani non stop, tako da...
Mislim, izvini, nisam htala da zvuči
kao da si došla iz malog rada, pa ne možeš da se snađaš,
nego... Ma znam, opuštaj.
Ali svaka ti čast. Ja bi se ubila
da sam morala u četvrtu godini dostaviti društvo.
E, nisam mogla mnogo dobirat.
Ali bolje. Tamo bi se moji stavno sretali,
bilo bi nepretnije situacije, tako da...
Kapiram.
Pa i ja ponekad poželim da se moji razvedu,
ali uf, nema šansi.
Išćemo kod mene. Prazda mi gajba. Ajde. Taman mi Uroš poslao neki kratki film, pa možemo da gledam.
Kaća. Jel moramo? Pa kratak je.
Ajme, idećemo. Ćao.
Ćao, vidimo se.
Gde si?
Ja imam ga kod kuće, da si ti.
Sama sam. Sve razlika od tebe.
Šta pričaš?
Videla sam sliku, Petar.
Koju sliku?
E, ajde, nemoj da mi se pravi šud, molim te.
Pa šta? Mislim, ništa se ne dešava, šta?
Pa na svici mi ne izgleda kao da se ništa ne dešava.
Kažem ti da je tako. Što mi smaraš?
Zašto te smaram? Pa zato što sam ja ovde,
i zato što se trudim da ne uradim ništo što tebe može da pogredi,
a tebe očigledno boli uvoz za to, jel?
Šta je tebi? Šta je?
Nedostaješ mi. Te pijemo jedan.
Pa šta hoćeš da ti kažem?
Ti si tamo, a ja sam ovde.
Dobro, nismo na različitim continentima.
I ti si tražio da ostanemo u vezi. Šta hoćeš sad?
Znam, ali...
Čudno mi je to što te ne vidim svakog dana.
Znam.
I meni.
I? Šta ćemo sada?
Nemam pojma.
E, odličan predlog, Petar. Nemaš pojma.
Super, bravo, svaka čast.
E, slušaj.
A šta misliš da još malo sačekamo,
pa da vidimo šta će biti, a?
I? Šta će se dogodi kada sačekamo malo?
Bićeš s nekom drugom devojkom, jel?
Sve mi je jasno.
Ajde, čau, Petar.
Bojana!
E, sećite se onoga propo nagradi ili kazne za naše prethodne postupke?
Pa evo.
Ja sam upravo dobila jednu pacu.
A da ne znam, možda je Petar bio upravo.
Veze su i tako komplikirane,
veze su i tako komplikirane
i treba da se mnogo radi na njima,
a mi smo im još dodali
onaj mrski pridev na daljinu.
Veza na daljinu, Bojana,
jedan nula.
Po razredu, tebe nije stremo
da se pojaviš posle one ispale, a?
Brate, sam ti rekao
da si imao probleme u školi sa roditeljima.
Slušaj, mene ne zanimaju tvoji problemi
sa roditeljima i sa školom.
Mene zanima ekipa i šta se dešava sa ekipom,
a ti si ispalio ekipu.
E, ste vi izgubili, a?
Slušaj, kakva je vaza ima šta smo mi izgubili?
Mi smo izgubili zato što smo se skremali kao ekipa,
a ti si ispalio.
Ja sam ti dao jednu priliku, a se iskažeš i nisi iskoristio. Šta hoćeš?
Pazi, šta pričaš, bit će problem.
Čekaj, šta se dešava?
Što treba, došla zvezda.
Dosta je bilo.
Hoćemo li da igramo ili nećemo?
Hoćemo.
Mariću, hoćemo?
Hajde.
Sanja!
Hoćeš da mi opeglaš ovo, ljubite mužići?
Ovo, a?
E.
To možeš sam da ispeglaš.
Zašto? Šta nije u redu?
Milutine, ako ja idem u ovoj haljini i u ovim cipelama,
i ako se ne znaš,
to ćeš ići ići sa mnom.
Sa mnom?
Sa mnom.
Sa mnom.
Sa mnom.
I ako sam bila kod frizera da se isfeniram,
onda ti ne možeš da ideš na Slavu kao John Wayne.
A zašto?
Pa jel ovo mi ide na posao, ženo bože?
E pa zato nisi direktor, nego si mastiljar.
O jel?
Pa to kod vas u Crnoj gori, tako obučeš odelo
i postaneš direktor.
Ovde je malo drugačija procedura.
Šta je, šta se širiš, čoveče?
Skupi se malo,
da nam nije majkine kuće u budvu.
Mi bi smo pocrkali od gladi.
Hajde.
Mariću!
Vidimo se.
Mariću.
Slušaj.
Ovakve scene više
u timu neću.
Znam, ali nisam ja kriv.
Znam, vidio sam sve.
Ne moraš sve da mi objašnjavaš.
Jednu stvar da ti kažem.
Izneverio si tim.
Ali sam javio šta se desilo.
Znam, to mi jasno, ali to ne sme da te koči.
Ta utakmica je bila veoma važna.
Znam.
I sledeća utakmica je važna.
Znam i to.
Igramo preko sutra.
Znam i to.
Moraš da se odlučiš.
Teren, naravno.
Teren. Sigurno?
Pa da.
Onda te molim da moraš da shvatiš ozbiljnost
sledećeg utakmica.
Trenirat ćemo intenzivno i
izostat ćeš iz škole dva dana.
Je li u redu?
Pa nema problema.
Hajde, vidimo se onda sutra.
Vidimo se.
Mariću.
Ideš ka slavi?
Da, da.
Oooo.
A gde ćete vi?
Idemo kod Sakića na slavu.
Uuu, pa donesite mi ona njihova bajadera prase.
Donjeće, majka.
E, a kako je bilo u školi?
Pa ništa, ovaj...
Dala mi je keca iz fizike.
Opet?
Nije ti ona dala keca.
Nego si ti dobio keca, magarče jedan.
Što ima da me pita?
Tek je počela škola.
Oće da proveri da li si ušao.
Oće da proveri da li si ozbiljen
u vezi sa dogovorom od Avgusta.
Šta ti nije jasno?
Ona mi nije jasna.
Čekaj, Vasilije, čekaj. Očigledno je da ti ne ide.
Zvaćemo spomenku.
Ne treba nikoga da zovemo, popraviće mi razredni to.
Ma kako može razredni da ti popravi
ocenu iz fizike?
Ne lupetaj. Zvaćemo spomenku da dođe sutra,
preko sutra već.
Ne mogu sad da imam na času, imam intenzivne treninge zbog turnira.
Ma kakvi intenzivni treninzi?
Kakvi turniri?
Ne mogu opet da padneš.
Tek je prvo polugodište.
Moramo da reagujemo na vreme.
Nema diskusi, imaš časove i gotovo.
Što volim što se lepo slažete?
Samo kad mene treba da mal tretirate.
Vasilije, čekaj.
A i ti. Ajde požuri, gladan sam.
Ako obučeš ovaj stojnak,
ja Boga mi ne idem.
Dobro, ajde reci šta da obučem.
Pa imaš toliko
predivnih košilja, stvarno.
Šta fali ovoj?
Šest evra sam dao za nju.
Dobro, da li bi opet bio sa malom jecom?
To mene interesuje.
E, Mihajlo, ajde stvarno, prestani.
Šta fali maloj jeci, brate?
Ćao, Bojena.
Koja je mala jeca?
Ćutiš više.
Evo ja ću ja ti kažem.
Mala jeca je neka priča pre nego što si ti došla u školu.
I u suštini nije ni bitno.
Dobro, a što nećeš da Bojena sad zna za to?
Pa i ona je sad deo ekipe, maj.
Češ da ju čutiš više?
Mora da zna deoika.
Mihajlo?
Bojena.
Ajde, kasnijemo na čas.
Budav.
Razredni, imate pet minuti.
E, Vasim.
Htio bih da razgovaram sa vama nešto.
Da, ja sam s tobom hteo nešto da popričam.
Vidi, ja sam razgovarao sa nastavnicom fizike.
Znači, dobra, vesti baš brzo putuju.
A šta da radim kad me žena uzela na zup?
Kako te uzela na zup?
Ona kaže da te pitala gradivo prošle godine,
a sve si u augustu već odgovarala.
Jesam pa.
Šta si, zaboravio?
Davno bi i u august, Razredni.
Ti znaš da sam ja nju izmolio
da te pita sledećeg časa?
Ali to je preko sutra, neću ništa,
svi će da naučim.
Pa dobro, ali sad ti je početak školske godine.
Sad imaš malo gradivao, sedneš,
uzmeš dva, tri časa fizike.
Nek ti koska pomoga.
Evo, može i Mihajlo.
Mihajlo je fantastičan iz fizike.
Znam ja to, ali teo sam nešto drugo da vas molim.
Da?
Da ti imam košarkarski turnir, pa bih morao da izostanem
danas i sutra iz škole.
A,
znaš šta, nemamo mi
mnogo kredita kod nje.
To je nastavnica stare škole,
shvataš, neće te pustiti da proćeš.
A, znam, ali
realno ja nisam znao fiziku, niti ću ikada znati.
Košarkar je nešto što mi ide i ne moram da ulažem
dodatni trud.
A jel je bez truda?
Pa bez truda. Što ćeš ceo život da radiš
samo ono za što ti ne treba trud?
Pa da.
Znaš kako to funkcioniš?
Ti moraš da pokažeš
dobro voljo, razumiš?
Jedan korak napraviš ti, drugi korak
napravi ona. Kapiraš?
A? Šta kažeš?
A znam ja to sve razrednje, ali
ovo mi je baš bitno.
Mislim, taj turnir i košarka.
Ne znam, vidjet ćemo. Da vas ne zadržavam
više, hvala vam puno, pa
pričat ćemo.
Dobro, hajde, vas pričat ćemo.
Doviđenja, profesore. Doviđenja.
Hvala sa tom iskronom da upadneš u katozu, jer
ti je onda telo sagoreva masti pošto ne unosiš
ugljene hidrate, razumiš?
Jel slušaš ti mene uopšte?
Ne.
Daj da vidim, šta je to?
Zove se izazov generacije.
Fore je kao da kačeš
klipove i da dobiješ više lajkova.
I onda kao možeš da pređeš u sledeću
kategoriju, a to je da ti nakon drugom
zadeš izazov. Kao naprimjer, ne znam, da si je
poljubiš nekim, na tako nešto.
Pa kao fot. Pa da, samo što
ovde se još i glasa kao za
najbolje izazove separira u humanitarne svrhe.
Dobro je fore.
I jedino što gluposti samo pobeđuje.
Pogledaj sad ovog debila.
Čekaj, on će sad
pojede celu ovu pizzu.
Bolid. A dobro, sladaki.
Mada i ja sam te mu glupo izazovala. Ma ima
dve i po hiljade lajkova. A vidi sad ovo.
Samo reci
tebi, mogu mora.
Kida likuš.
A ima dvadeset
lajkova. Bebek.
Evo, dobili još dva.
Pa to ti kaže. A čekaj,
ako je to humanitarno, zašto ne bismo i mi nešto postavili?
Šta, nešto pametno ili
glupo? Nešto pametno i gotivno.
Svako može da smisli budalaštinu.
To je bar lako. Ver mi da nije lako.
A nismo ni mi ti mozgovi.
Mi smo baš ti mozgovi.
Halo.
Evo idem na trening, vrati.
Nema veze, neka me upiše, onako ću
prvdanje iz kluba, šta.
E, ajde, moram da idem, ajde. Ajde, ćao, ćao.
Evo,
otišao na trening. Znači rešile.
Mhm.
Šta su usamljali?
Nemam pojma.
Prije mi.
Nisa kaj mi si progovarila danas?
Nisam.
Si nešto ljuta?
Nisam ljuta, Koska.
Samo sam
sam.
A daj šta ti, imaš novo društvo.
A mi smo od Adriana gotivi.
Ne znam baš.
Ma ajde, ne tripuj.
Pa ne, i ti danas.
Ja kapiram, ti imaš sa njima neki internet foru,
ali toliko da mi izbesne, što te pitam koja je Mala Jeca,
stvarno ne kapiram.
Preči ću ti.
Mala Jece ne postoji.
Nju si izmislili Mihajlo i Vas.
Uzeli su u karticu i
dopis jeveli su sa mnom sa neopoznatog broja.
Ja sam se primio
i dopis jeveli smo se
četiri dana. Koliko?
Četiri dana.
Slali su mi pesme, slali su mi slike i
na kraju sam otišao i na dejt.
I?
I šta i?
Ićao sam tamo dva i po sata.
Baš se primio.
Već zašto negotivim da se
ta tema pogreće.
Kapiram. Izvini.
Ali to nema nikakveza sa tim što si ti
naučila u školi.
Kapiram.
E, Koska,
ovaj,
je li bila dobra riba ta Mala Jeca?
Bojna.
A nije, nego, ne znam, čudno mi je sve.
U Beogradu sam ona nova devika koja je došla.
U Mitrovici sam ona koja je otišla.
Nemam pojma.
Kao, ono, da nigde ne pripadam,
bukvalno.
Ej, izvini, mislim da sam te malo loše procenio.
Nisam očekivao od tebe da ćeš da
kukaš kod Andrijana i Kaćenezova.
Pa i među drugih u školi.
Ti dosta treninga, a?
Nikad nije dosta.
Daj vam.
Slušaj,
ti sam sve ono mislio što sam ti rekao.
Malagano.
Aj, brate, mnogo dobro igraš.
A nisi ni ti loš.
Ćemo da ih razbijemo sutra.
Zna se.
Ajde, Jane, ajde.
Opa.
Ajde.
Opa.
A, vidim, našao si prasetinu.
Vrhunska je.
A što s majonezem?
Što da ne?
Slušaj, čula sam se sa spomenkom,
dođi će sutra u tri.
Ne mogu sutra.
A kad si mislio kad ti je u sredu fizika?
Ne znam kad, ali sutra ne mogu, imam utakmicu.
Vasilije, ja sam tebi rekla
da ti je škola sada primarna.
Košarka je samo tvoj hobi.
Kakav hobi?
Je li mi letos prišao onaj scout?
Ma kakvi scout? Koji scout?
I što, je li ti se javio od tad?
Nije, ali nikad se ne zna.
Ma što se nikad ne zna?
Da je to bio ozbiljan tip, on bi ti se već do sad javio.
Ne mogu ja vie, stvarno.
Vasilije!
Vasilije!
asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf`




function splitString(str) {
  let splitStrings = [];
  let currentString = "";
  const splitString = str.split('\n');

  l('total lines')
  l(splitString.length);

  let counter = 0;
  for(const string of splitString) {
    counter++
    if(currentString.length < 5000) {
      l('not too long')
      currentString = `${currentString}${string}\n`
      if (counter === splitString.length) {
        splitStrings.push(currentString);
      }
      // currentString = currentString + string + '\n';
    } else {
      l('too long')
      splitStrings.push(currentString);
      currentString = "";
    }
  }
  return splitStrings;
}

const chunks = splitString(textToTranslate);

l('chunks');
l(chunks.length);

let recombined = "";
for(const chunk of chunks) {
  recombined = recombined + chunk;
}

l('recombined');
l(recombined.length);

// l(textToTranslate)

// const chunks = splitString(textToTranslate);
//
// l('chunks', chunks);

const resplit = recombined.split('\n');
l('resplit');
l(resplit.length);
// l(textToTranslate.split('\n').length));


async function translateText({ text, targetLanguageCode }){
  const url = generateRequestUrl(text, { to: targetLanguageCode });
  l('generated url');
  l(url);

  let response;
  try {
    response = await axios.get(url);

    const parsedResponse = normaliseResponse(response.data);
    // l('parsedResponse');
    // l(parsedResponse);

    const translatedText = parsedResponse.text;
    l('translatedText');
    l(translatedText);

    return translatedText;
  } catch (error) {
    l('errored');
    // l('error', error);
  }
}

async function splitAndTranslateText({ text, targetLanguageCode }){
  const chunks = splitString(text);
  l('chunks');
  l(chunks.length);

  let translatedText = "";
  for(const chunk of chunks) {
    const translatedChunk = await translateText({ text: chunk, targetLanguageCode });
    translatedText = translatedText + translatedChunk;
  }

  return translatedText;
}

async function newMain(){
  let totalTranslatedText = "";
  for(const chunk of chunks) {
    const translated = await translateText({
      text: chunk,
      targetLanguageCode: 'en'
    });

    totalTranslatedText = totalTranslatedText + translated;
  }

  l('totalTranslatedText');
  l(totalTranslatedText);
}

// newMain()

async function main(){
  try {
    const translated = await translateText({
      text: textToTranslate,
      targetLanguageCode: 'en'
    });

    // l('translated');
    // l(translated);
  } catch (err){
    l('err');
    l(err);
  }
}

// main();

module.exports = splitAndTranslateText;
