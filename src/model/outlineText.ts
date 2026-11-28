/**
 * The offline study outline, in every Wikipedia language a disc can be burned in. Pure data:
 * each entry turns a topic into the outline's six headings, six paragraphs, and source label.
 * English is the original wording, unchanged.
 */
import type { WikiLanguage } from './languages';

export interface OutlineText {
  headings: string[];
  paragraphs: string[];
  /** The source label, which says plainly that this is an outline. */
  label: string;
}

export const OUTLINE_TEXT: Readonly<Record<WikiLanguage, (t: string) => OutlineText>> = {
  en: (t) => ({
    headings: [
      `${t}: offline study outline`,
      `Key terms in ${t}`,
      `Where you have met ${t}`,
      `Questions to explore about ${t}`,
      `Where to learn more about ${t}`,
      `Putting ${t} into practice`,
    ],
    paragraphs: [
      `This is an offline study outline for ${t}, not an encyclopedia article. No article text could be fetched, so use this page to write down what you already know about ${t}.`,
      `List the words and names you expect to meet while studying ${t}, then look each one up once you are back online.`,
      `Think of one place where you have seen ${t} and note what you would like to understand better.`,
      `Write three questions about ${t} that you want answered before you finish studying.`,
      `Pick a library, a teacher, or a trusted website and plan when you will read about ${t}.`,
      `Choose a small exercise that lets you try ${t} yourself, and note what you learn from it.`,
    ],
    label: `Topic: ${t} (offline study outline)`,
  }),
  fr: (t) => ({
    headings: [
      `${t} : plan d'étude hors ligne`,
      `Termes clés de ${t}`,
      `Où vous avez rencontré ${t}`,
      `Questions à explorer sur ${t}`,
      `Où en apprendre plus sur ${t}`,
      `Mettre ${t} en pratique`,
    ],
    paragraphs: [
      `Ceci est un plan d'étude hors ligne pour ${t}, et non un article d'encyclopédie. Aucun texte d'article n'a pu être récupéré : utilisez cette page pour noter ce que vous savez déjà sur ${t}.`,
      `Dressez la liste des mots et des noms que vous pensez rencontrer en étudiant ${t}, puis cherchez-les une fois de nouveau en ligne.`,
      `Pensez à un endroit où vous avez vu ${t} et notez ce que vous aimeriez mieux comprendre.`,
      `Écrivez trois questions sur ${t} auxquelles vous voulez une réponse avant la fin de votre étude.`,
      `Choisissez une bibliothèque, un enseignant ou un site de confiance, et prévoyez quand vous lirez sur ${t}.`,
      `Choisissez un petit exercice pour essayer ${t} vous-même, et notez ce que vous en apprenez.`,
    ],
    label: `Sujet : ${t} (plan d'étude hors ligne)`,
  }),
  de: (t) => ({
    headings: [
      `${t}: Offline-Lernübersicht`,
      `Schlüsselbegriffe zu ${t}`,
      `Wo Ihnen ${t} begegnet ist`,
      `Fragen zu ${t}`,
      `Wo Sie mehr über ${t} erfahren`,
      `${t} in der Praxis`,
    ],
    paragraphs: [
      `Dies ist eine Offline-Lernübersicht zu ${t}, kein Lexikonartikel. Es konnte kein Artikeltext abgerufen werden. Notieren Sie auf dieser Seite, was Sie bereits über ${t} wissen.`,
      `Listen Sie die Wörter und Namen auf, die Ihnen beim Lernen über ${t} begegnen dürften, und schlagen Sie jedes nach, sobald Sie wieder online sind.`,
      `Denken Sie an einen Ort, an dem Sie ${t} gesehen haben, und notieren Sie, was Sie besser verstehen möchten.`,
      `Schreiben Sie drei Fragen zu ${t} auf, die Sie vor dem Ende Ihres Lernens beantwortet haben möchten.`,
      `Wählen Sie eine Bibliothek, eine Lehrkraft oder eine vertrauenswürdige Website und planen Sie, wann Sie über ${t} lesen.`,
      `Wählen Sie eine kleine Übung, mit der Sie ${t} selbst ausprobieren, und notieren Sie, was Sie dabei lernen.`,
    ],
    label: `Thema: ${t} (Offline-Lernübersicht)`,
  }),
  es: (t) => ({
    headings: [
      `${t}: esquema de estudio sin conexión`,
      `Términos clave de ${t}`,
      `Dónde has encontrado ${t}`,
      `Preguntas para explorar sobre ${t}`,
      `Dónde aprender más sobre ${t}`,
      `Poner en práctica ${t}`,
    ],
    paragraphs: [
      `Este es un esquema de estudio sin conexión sobre ${t}, no un artículo de enciclopedia. No se pudo obtener el texto del artículo, así que usa esta página para anotar lo que ya sabes sobre ${t}.`,
      `Haz una lista de las palabras y los nombres que esperas encontrar al estudiar ${t} y busca cada uno cuando vuelvas a tener conexión.`,
      `Piensa en un lugar donde hayas visto ${t} y anota lo que te gustaría entender mejor.`,
      `Escribe tres preguntas sobre ${t} que quieras responder antes de terminar de estudiar.`,
      `Elige una biblioteca, un profesor o un sitio web de confianza y planifica cuándo leerás sobre ${t}.`,
      `Elige un pequeño ejercicio para probar ${t} por tu cuenta y anota lo que aprendas.`,
    ],
    label: `Tema: ${t} (esquema de estudio sin conexión)`,
  }),
  it: (t) => ({
    headings: [
      `${t}: schema di studio offline`,
      `Termini chiave di ${t}`,
      `Dove hai incontrato ${t}`,
      `Domande da esplorare su ${t}`,
      `Dove saperne di più su ${t}`,
      `Mettere in pratica ${t}`,
    ],
    paragraphs: [
      `Questo è uno schema di studio offline su ${t}, non una voce di enciclopedia. Non è stato possibile recuperare il testo della voce: usa questa pagina per annotare ciò che sai già su ${t}.`,
      `Elenca le parole e i nomi che prevedi di incontrare studiando ${t}, poi cercali uno per uno quando sarai di nuovo online.`,
      `Pensa a un luogo in cui hai visto ${t} e annota ciò che vorresti capire meglio.`,
      `Scrivi tre domande su ${t} a cui vuoi trovare risposta prima di finire lo studio.`,
      `Scegli una biblioteca, un insegnante o un sito affidabile e pianifica quando leggerai di ${t}.`,
      `Scegli un piccolo esercizio per provare ${t} da solo e annota ciò che impari.`,
    ],
    label: `Argomento: ${t} (schema di studio offline)`,
  }),
  pt: (t) => ({
    headings: [
      `${t}: roteiro de estudo offline`,
      `Termos-chave de ${t}`,
      `Onde você encontrou ${t}`,
      `Perguntas para explorar sobre ${t}`,
      `Onde aprender mais sobre ${t}`,
      `Pôr ${t} em prática`,
    ],
    paragraphs: [
      `Este é um roteiro de estudo offline sobre ${t}, e não um artigo de enciclopédia. Não foi possível obter o texto do artigo, então use esta página para anotar o que você já sabe sobre ${t}.`,
      `Liste as palavras e os nomes que espera encontrar ao estudar ${t} e pesquise cada um quando estiver online novamente.`,
      `Pense num lugar onde você viu ${t} e anote o que gostaria de entender melhor.`,
      `Escreva três perguntas sobre ${t} que você quer responder antes de terminar o estudo.`,
      `Escolha uma biblioteca, um professor ou um site confiável e planeje quando vai ler sobre ${t}.`,
      `Escolha um pequeno exercício para experimentar ${t} por conta própria e anote o que aprender.`,
    ],
    label: `Tema: ${t} (roteiro de estudo offline)`,
  }),
  nl: (t) => ({
    headings: [
      `${t}: offline studieoverzicht`,
      `Kernbegrippen van ${t}`,
      `Waar je ${t} bent tegengekomen`,
      `Vragen over ${t}`,
      `Waar je meer leert over ${t}`,
      `${t} in de praktijk`,
    ],
    paragraphs: [
      `Dit is een offline studieoverzicht over ${t}, geen encyclopedieartikel. Er kon geen artikeltekst worden opgehaald, dus gebruik deze pagina om op te schrijven wat je al weet over ${t}.`,
      `Maak een lijst van de woorden en namen die je verwacht tegen te komen bij het bestuderen van ${t}, en zoek ze op zodra je weer online bent.`,
      `Denk aan een plek waar je ${t} hebt gezien en noteer wat je beter wilt begrijpen.`,
      `Schrijf drie vragen over ${t} op die je beantwoord wilt hebben voordat je klaar bent met studeren.`,
      `Kies een bibliotheek, een docent of een betrouwbare website en plan wanneer je over ${t} gaat lezen.`,
      `Kies een kleine oefening om ${t} zelf te proberen en noteer wat je ervan leert.`,
    ],
    label: `Onderwerp: ${t} (offline studieoverzicht)`,
  }),
  pl: (t) => ({
    headings: [
      `${t}: plan nauki offline`,
      `Kluczowe pojęcia – ${t}`,
      `Gdzie spotkałeś się z tematem: ${t}`,
      `Pytania do zbadania – ${t}`,
      `Gdzie dowiedzieć się więcej – ${t}`,
      `${t} w praktyce`,
    ],
    paragraphs: [
      `To jest plan nauki offline dla tematu „${t}”, a nie artykuł encyklopedyczny. Nie udało się pobrać tekstu artykułu, więc zapisz na tej stronie to, co już wiesz na ten temat.`,
      `Wypisz słowa i nazwy, które spodziewasz się napotkać podczas nauki, i sprawdź każde z nich, gdy znów będziesz online.`,
      `Pomyśl o miejscu, w którym zetknąłeś się z tematem „${t}”, i zanotuj, co chciałbyś lepiej zrozumieć.`,
      `Zapisz trzy pytania dotyczące tematu „${t}”, na które chcesz znaleźć odpowiedź przed końcem nauki.`,
      `Wybierz bibliotekę, nauczyciela lub zaufaną stronę internetową i zaplanuj, kiedy przeczytasz o tym temacie.`,
      `Wybierz małe ćwiczenie, by samodzielnie wypróbować ten temat, i zanotuj, czego się nauczysz.`,
    ],
    label: `Temat: ${t} (plan nauki offline)`,
  }),
  ja: (t) => ({
    headings: [
      `${t}：オフライン学習アウトライン`,
      `${t}の重要用語`,
      `${t}に出会った場所`,
      `${t}について探る質問`,
      `${t}をさらに学ぶには`,
      `${t}を実践する`,
    ],
    paragraphs: [
      `これは${t}のオフライン学習アウトラインで、百科事典の記事ではありません。記事の本文を取得できなかったため、このページに${t}について知っていることを書き留めてください。`,
      `${t}を学ぶときに出会いそうな言葉や名前を書き出し、オンラインに戻ったらひとつずつ調べましょう。`,
      `${t}を見かけた場所をひとつ思い浮かべ、もっと理解したいことをメモしましょう。`,
      `学習を終えるまでに答えを知りたい、${t}についての質問を三つ書きましょう。`,
      `図書館、先生、信頼できるウェブサイトを選び、${t}について読む予定を立てましょう。`,
      `${t}を自分で試せる小さな練習を選び、そこから学んだことを記録しましょう。`,
    ],
    label: `トピック：${t}（オフライン学習アウトライン）`,
  }),
  ko: (t) => ({
    headings: [
      `${t}: 오프라인 학습 개요`,
      `${t}의 핵심 용어`,
      `${t}을(를) 접한 곳`,
      `${t}에 대해 탐구할 질문`,
      `${t}에 대해 더 배울 곳`,
      `${t} 실천하기`,
    ],
    paragraphs: [
      `이것은 ${t}에 대한 오프라인 학습 개요이며 백과사전 문서가 아닙니다. 문서 본문을 가져올 수 없었으니, 이 페이지에 ${t}에 대해 이미 알고 있는 내용을 적어 보세요.`,
      `${t}을(를) 공부하면서 만날 것 같은 단어와 이름을 적어 두고, 다시 온라인에 연결되면 하나씩 찾아보세요.`,
      `${t}을(를) 본 적이 있는 곳을 하나 떠올리고 더 이해하고 싶은 점을 메모하세요.`,
      `공부를 마치기 전에 답을 알고 싶은 ${t}에 관한 질문 세 가지를 적어 보세요.`,
      `도서관, 선생님 또는 믿을 만한 웹사이트를 골라 ${t}에 대해 언제 읽을지 계획하세요.`,
      `${t}을(를) 직접 해 볼 수 있는 작은 연습을 골라 배운 점을 기록하세요.`,
    ],
    label: `주제: ${t} (오프라인 학습 개요)`,
  }),
  zh: (t) => ({
    headings: [
      `${t}：离线学习提纲`,
      `${t}的关键术语`,
      `你在哪里接触过${t}`,
      `关于${t}值得探究的问题`,
      `去哪里进一步了解${t}`,
      `把${t}付诸实践`,
    ],
    paragraphs: [
      `这是关于${t}的离线学习提纲，而不是百科条目。无法获取条目正文，请在此页记下你已经了解的关于${t}的内容。`,
      `列出学习${t}时可能遇到的词语和名称，重新联网后逐一查找。`,
      `想一想你在哪里见过${t}，记下你希望进一步理解的地方。`,
      `写下三个关于${t}、希望在学习结束前得到解答的问题。`,
      `选一家图书馆、一位老师或一个可靠的网站，计划好何时阅读有关${t}的资料。`,
      `选一个小练习亲自尝试${t}，并记下你的收获。`,
    ],
    label: `主题：${t}（离线学习提纲）`,
  }),
  ar: (t) => ({
    headings: [
      `${t}: مخطط دراسي دون اتصال`,
      `المصطلحات الأساسية في ${t}`,
      `أين صادفت ${t}`,
      `أسئلة لاستكشاف ${t}`,
      `أين تتعلم المزيد عن ${t}`,
      `تطبيق ${t} عمليًا`,
    ],
    paragraphs: [
      `هذا مخطط دراسي دون اتصال عن ${t}، وليس مقالة موسوعية. تعذّر جلب نص المقالة، لذا استخدم هذه الصفحة لتدوين ما تعرفه بالفعل عن ${t}.`,
      `اكتب قائمة بالكلمات والأسماء التي تتوقع أن تصادفها أثناء دراسة ${t}، ثم ابحث عن كل منها عندما تعود إلى الاتصال.`,
      `فكّر في مكان رأيت فيه ${t} ودوّن ما تودّ فهمه بشكل أفضل.`,
      `اكتب ثلاثة أسئلة عن ${t} تريد الإجابة عنها قبل أن تنهي دراستك.`,
      `اختر مكتبة أو معلمًا أو موقعًا موثوقًا، وخطّط لموعد قراءتك عن ${t}.`,
      `اختر تمرينًا صغيرًا لتجرّب ${t} بنفسك، ودوّن ما تتعلمه منه.`,
    ],
    label: `الموضوع: ${t} (مخطط دراسي دون اتصال)`,
  }),
  sv: (t) => ({
    headings: [
      `${t}: studieöversikt offline`,
      `Nyckelbegrepp inom ${t}`,
      `Var du har stött på ${t}`,
      `Frågor att utforska om ${t}`,
      `Var du kan lära dig mer om ${t}`,
      `Att omsätta ${t} i praktiken`,
    ],
    paragraphs: [
      `Det här är en studieöversikt offline om ${t}, inte en uppslagsartikel. Ingen artikeltext kunde hämtas, så använd sidan för att skriva ner det du redan vet om ${t}.`,
      `Lista de ord och namn du räknar med att möta när du studerar ${t}, och slå upp vart och ett när du är online igen.`,
      `Tänk på ett ställe där du har sett ${t} och anteckna vad du vill förstå bättre.`,
      `Skriv tre frågor om ${t} som du vill ha svar på innan du är klar med studierna.`,
      `Välj ett bibliotek, en lärare eller en pålitlig webbplats och planera när du ska läsa om ${t}.`,
      `Välj en liten övning där du själv provar ${t}, och anteckna vad du lär dig.`,
    ],
    label: `Ämne: ${t} (studieöversikt offline)`,
  }),
  tr: (t) => ({
    headings: [
      `${t}: çevrimdışı çalışma taslağı`,
      `${t} ile ilgili temel terimler`,
      `${t} ile nerede karşılaştınız`,
      `${t} hakkında keşfedilecek sorular`,
      `${t} hakkında daha fazlasını öğrenmek için`,
      `${t} konusunu uygulamaya dökmek`,
    ],
    paragraphs: [
      `Bu, ${t} için çevrimdışı bir çalışma taslağıdır, bir ansiklopedi maddesi değildir. Madde metni alınamadı; bu sayfayı ${t} hakkında zaten bildiklerinizi yazmak için kullanın.`,
      `${t} çalışırken karşılaşmayı beklediğiniz kelimeleri ve adları listeleyin, yeniden çevrimiçi olduğunuzda her birine bakın.`,
      `${t} ile karşılaştığınız bir yeri düşünün ve daha iyi anlamak istediğiniz şeyi not edin.`,
      `Çalışmanızı bitirmeden önce yanıtlamak istediğiniz, ${t} hakkında üç soru yazın.`,
      `Bir kütüphane, bir öğretmen ya da güvenilir bir web sitesi seçin ve ${t} hakkında ne zaman okuyacağınızı planlayın.`,
      `${t} konusunu kendiniz denemenizi sağlayacak küçük bir alıştırma seçin ve öğrendiklerinizi not edin.`,
    ],
    label: `Konu: ${t} (çevrimdışı çalışma taslağı)`,
  }),
};
