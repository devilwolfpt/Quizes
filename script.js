// ------------------------------------------------------------
// Perguntas — para editar: muda o texto, as opções ou o índice
// da resposta certa ("answer" começa em 0).
// ------------------------------------------------------------
const QUESTIONS = [
  {
    q: "Que percentagem da superfície da Terra é coberta pelos oceanos?",
    options: ["51%", "61%", "71%", "85%"],
    answer: 2,
    why: "Os oceanos cobrem 71% da superfície da Terra e absorvem mais de 90% do excesso de calor do planeta."
  },
  {
    q: "Quantas pessoas vivem em zonas costeiras baixas e são afetadas diretamente pela subida do mar?",
    options: ["Cerca de 60 milhões", "Mais de 600 milhões", "Cerca de 6 mil milhões", "Menos de 10 milhões"],
    answer: 1,
    why: "Mais de 600 milhões de pessoas vivem em zonas costeiras baixas."
  },
  {
    q: "Quais são as duas principais causas da subida do nível médio do mar?",
    options: [
      "Aumento das marés e queda de meteoritos",
      "Derretimento das calotas polares e expansão térmica dos oceanos",
      "Chuvas mais fortes e erosão das praias",
      "Atividade vulcânica e terramotos submarinos"
    ],
    answer: 1,
    why: "O aquecimento global acelera o derretimento das calotas polares e faz a água dilatar-se (expansão térmica)."
  },
  {
    q: "Quanto subiu, aproximadamente, o nível médio dos oceanos desde 1900?",
    options: ["1 a 3 cm", "5 a 8 cm", "15 a 25 cm", "1 a 2 metros"],
    answer: 2,
    why: "As medições históricas mostram uma subida de 15 a 25 cm desde 1900, com aceleração nas últimas décadas."
  },
  {
    q: "Que dois tipos de registos confirmam a aceleração da subida do mar?",
    options: [
      "Fotografias aéreas e mapas antigos",
      "Marégrafos e satélites",
      "Sismógrafos e radares meteorológicos",
      "Diários de bordo e relatos históricos"
    ],
    img: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Sea_level_rise_trend_2022.gif",
      alt: "Animação da NASA com as tendências do nível do mar entre 1993 e 2022, medidas por satélite",
      cap: "Satélites a medir o nível do mar (1993–2022). Fonte: NASA, domínio público, via Wikimedia Commons."
    },
    answer: 1,
    why: "Os registos de marégrafos (na costa) e de satélites (a partir do espaço) confirmam a aceleração."
  },
  {
    q: "Qual destes NÃO é uma barreira natural contra a subida do mar?",
    options: ["Manguezais", "Zonas húmidas", "Recifes de coral", "Autoestradas costeiras"],
    img: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Mangroves.jpg?width=900",
      alt: "Raízes de mangue mergulhadas na água junto à costa",
      cap: "Raízes de mangue. Fonte: obra do governo federal dos EUA (domínio público), via Wikimedia Commons."
    },
    answer: 3,
    why: "Manguezais, zonas húmidas e recifes de coral absorvem a energia das ondas e reduzem a erosão. Uma autoestrada não protege a costa."
  },
  {
    q: "Que efeito da subida do mar afeta os rios e os aquíferos?",
    options: ["Acidificação", "Salinização", "Congelamento", "Assoreamento"],
    answer: 1,
    why: "A água salgada avança para o interior e provoca a salinização de rios e aquíferos, ameaçando comunidades e ecossistemas."
  },
  {
    q: "Que consequências pode ter o aumento do nível do mar para as pessoas?",
    options: [
      "Mais terras agrícolas junto à costa",
      "Deslocamento de populações e destruição de infraestruturas urbanas",
      "Diminuição da erosão nas praias",
      "Nenhuma, porque a subida é demasiado lenta"
    ],
    answer: 1,
    why: "A subida do mar desloca populações costeiras, destrói infraestruturas urbanas e causa perda irreversível de biodiversidade."
  },
  {
    q: "Segundo as projeções, quanto poderá subir o nível do mar até 2100?",
    options: ["5 a 10 cm", "20 a 30 cm", "0,5 a 1 metro", "5 a 10 metros"],
    answer: 2,
    why: "As projeções indicam uma elevação de 0,5 a 1 metro até 2100, ameaçando cidades costeiras, ilhas e ecossistemas marinhos."
  },
  {
    q: "Qual destas medidas é essencial para desacelerar o aquecimento global e conter a subida dos oceanos?",
    options: [
      "Aumentar o uso de combustíveis fósseis",
      "Construir mais cidades junto ao mar",
      "Reduzir as emissões de CO₂ com a transição para energias renováveis",
      "Esperar que os ecossistemas se adaptem sozinhos"
    ],
    answer: 2,
    why: "A transição energética para fontes renováveis reduz as emissões de CO₂. Acordos como o Acordo de Paris ajudam a coordenar essa ação a nível global."
  }
];

// ------------------------------------------------------------
// Elementos
// ------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// Fundos
// ------------------------------------------------------------
// Uma fotografia diferente por pergunta. Há 7 imagens para 10
// perguntas, por isso três repetem; o arranjo abaixo evita que a
// mesma imagem apareça duas vezes seguidas.
const FOTOS = [
  "beautiful-sea-landscape-with-water-nature_23-2151120270.jpg",
  "beautiful-sea-landscape-with-water-nature_23-2151120271.jpg",
  "coastal-landscape-fantasy-style_23-2151515083.jpg",
  "custom-hd-beach-sea-landscape-coconut-trees-wallpaper-3d-photo-background-panel-home-decor_1028938-144966.jpg",
  "painting-rocky-shore-with-rocks-sea-sun-shining-water_188544-12638.jpg",
  "stony-beach-landscape_23-2151716268.jpg",
  "view-breathtaking-beach-nature-landscape_23-2151682940.jpg",
];

// Índice da foto de cada pergunta (0..9).
const FOTO_POR_PERGUNTA = [0, 1, 2, 3, 4, 5, 6, 2, 5, 1];

// Duas camadas em sobreposição: escreve-se na que está escondida e
// passa-se a visível, para a troca ser um desvanecimento.
const bgA = $("bg-a");
const bgB = $("bg-b");
let bgCamada = 0;
let bgActual = "";

function mostrarFoto(indice) {
  const ficheiro = FOTOS[indice % FOTOS.length];
  if (ficheiro === bgActual) return;
  bgActual = ficheiro;

  const visivel = bgCamada % 2 === 0 ? bgA : bgB;
  const escondida = bgCamada % 2 === 0 ? bgB : bgA;
  escondida.style.backgroundImage = 'url("' + ficheiro + '")';
  // Um novo frame para o navegador registar a imagem nova antes de
  // a mostrarmos, senão o desvanecimento começa de uma camada vazia.
  requestAnimationFrame(() => {
    escondida.classList.add("is-on");
    visivel.classList.remove("is-on");
  });
  bgCamada++;
}

const screens = {
  intro: $("intro"),
  start: $("start"),
  quiz: $("quiz"),
  result: $("result"),
};
const gauge = $("gauge");
const ticks = $("ticks");
const counter = $("counter");
const questionTitle = $("question-title");
const optionsBox = $("options");
const feedback = $("feedback");
const nextBtn = $("next-btn");
const media = $("media");
const mediaImg = $("media-img");
const mediaCap = $("media-cap");

const TOTAL = QUESTIONS.length;
const SEGUNDOS_POR_PERGUNTA = 30;
let current = 0;
let score = 0;
let missed = [];
let locked = false;

// ------------------------------------------------------------
// Cronómetro: cada pergunta tem 30 segundos. Ao esgotar, a resposta
// certa é revelada e a pergunta conta como errada.
// ------------------------------------------------------------
const timerEl = $("timer");
const timerTime = $("timer-time");
const timerAviso = $("timer-aviso");
let timerId = 0;
let timerFim = 0;

function pararCronometro() {
  clearInterval(timerId);
  timerId = 0;
  timerEl.classList.add("is-done");
}

function iniciarCronometro() {
  pararCronometro();
  timerEl.classList.remove("is-done", "is-warn", "is-danger");
  timerAviso.textContent = "";
  timerFim = performance.now() + SEGUNDOS_POR_PERGUNTA * 1000;
  let avisou = false;

  const actualizar = () => {
    const restante = Math.max(0, timerFim - performance.now());
    const frac = restante / (SEGUNDOS_POR_PERGUNTA * 1000);
    timerTime.textContent = Math.ceil(restante / 1000);
    timerEl.style.setProperty("--t", frac.toFixed(3));
    timerEl.classList.toggle("is-warn", frac <= 0.5 && frac > 0.2);
    timerEl.classList.toggle("is-danger", frac <= 0.2);
    if (!avisou && restante <= 10000) {
      avisou = true;
      timerAviso.textContent = "Faltam 10 segundos para responder.";
    }
    if (restante <= 0) {
      pararCronometro();
      tempoEsgotado();
    }
  };

  actualizar();
  timerId = setInterval(actualizar, 200);
}

function tempoEsgotado() {
  if (locked) return;
  locked = true;
  const item = QUESTIONS[current];
  missed.push(current);

  optionsBox.querySelectorAll(".option").forEach((o) => {
    o.disabled = true;
    if (o.dataset.correct === "true") o.classList.add("is-correct");
    else o.classList.add("is-dim");
  });

  feedback.innerHTML = "";
  const title = document.createElement("strong");
  title.className = "bad";
  title.textContent = "Acabou o tempo!";
  const why = document.createElement("p");
  why.textContent = item.why;
  feedback.append(title, why);
  timerAviso.textContent = "Acabou o tempo. A resposta certa está a verde.";

  nextBtn.hidden = false;
  nextBtn.focus();
}

// ------------------------------------------------------------
// Marégrafo
// ------------------------------------------------------------
function buildTicks() {
  ticks.innerHTML = "";
  for (let i = 1; i <= TOTAL; i++) {
    const t = document.createElement("span");
    t.className = "tick";
    t.style.bottom = (i / TOTAL) * 100 + "%";
    t.textContent = i;
    ticks.appendChild(t);
  }
}

function setLevel(answered) {
  document.documentElement.style.setProperty("--level", answered / TOTAL);
  if (answered > 0) gauge.removeAttribute("data-empty");
  else gauge.setAttribute("data-empty", "");
  // A cena 3D de fundo acompanha a maré (ver scene3d.js).
  document.dispatchEvent(
    new CustomEvent("quiz:progress", { detail: { level: answered / TOTAL } })
  );
}

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------
// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------
// As formas das opções (triângulo, quadrado, círculo, losango,
// estrela) e as marcas de certo/errado são desenhadas em CSS,
// por isso aqui só é preciso saber quantas cores há.
const HUE_COUNT = 4;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function show(name) {
  // O cronómetro só corre no ecrã das perguntas.
  if (name !== "quiz") pararCronometro();
  Object.keys(screens).forEach((k) => (screens[k].hidden = k !== name));
  currentScreen = name;
  // O CSS sabe se está no ecrã de introdução (sem painel nem marégrafo).
  document.documentElement.dataset.screen = name;
  if (name === "intro") {
    $("intro-skip").focus({ preventScroll: true });
  } else {
    const heading = screens[name].querySelector("h1, h2");
    if (heading) heading.focus({ preventScroll: true });
  }
  // A cena 3D sabe qual é o ecrã atual (o título só existe na introdução).
  document.dispatchEvent(new CustomEvent("quiz:screen", { detail: { screen: name } }));
}

// ------------------------------------------------------------
// Introdução: o título fica um momento no ecrã e depois seguimos
// para o início do quiz. Não bloqueia nunca: o botão "Começar"
// salta a espera.
// ------------------------------------------------------------
const INTRO_MIN_MS = 3000; // tempo com o título à vista

let currentScreen = "intro";
const introStart = performance.now();
let introTimer = 0;

function leaveIntro() {
  clearTimeout(introTimer);
  if (currentScreen === "intro") show("start");
}

function scheduleIntro() {
  clearTimeout(introTimer);
  const wait = Math.max(0, INTRO_MIN_MS - (performance.now() - introStart));
  introTimer = setTimeout(leaveIntro, wait);
}

// A cena 3D avisava quando ficava pronta. Sem cenário 3D é só o
// tempo mínimo que decide, mas o aviso fica por causa do módulo
// scene3d.js, caso um dia volte a estar ligado.
// document.addEventListener("cena:pronta", scheduleIntro);

// ------------------------------------------------------------
// Fluxo do quiz
// ------------------------------------------------------------
function startQuiz() {
  current = 0;
  score = 0;
  missed = [];
  setLevel(0);
  mostrarFoto(FOTO_POR_PERGUNTA[0]);
  show("quiz");
  renderQuestion();
}

function renderQuestion() {
  const item = QUESTIONS[current];
  locked = false;

  counter.textContent = "Pergunta " + (current + 1) + " de " + TOTAL;
  questionTitle.textContent = item.q;
  // Cada pergunta tem a sua fotografia de fundo.
  mostrarFoto(FOTO_POR_PERGUNTA[current % FOTO_POR_PERGUNTA.length]);
  feedback.innerHTML = "";
  if (item.img) {
    mediaImg.onerror = () => {
      media.hidden = true;
      screens.quiz.classList.remove("has-media");
    };
    mediaImg.src = item.img.src;
    mediaImg.alt = item.img.alt;
    mediaCap.textContent = item.img.cap;
    media.hidden = false;
    screens.quiz.classList.add("has-media");
  } else {
    media.hidden = true;
    screens.quiz.classList.remove("has-media");
    mediaImg.removeAttribute("src");
  }
  nextBtn.hidden = true;
  nextBtn.textContent = current === TOTAL - 1 ? "Ver resultado" : "Seguinte";

  const opts = shuffle(
    item.options.map((text, i) => ({ text, correct: i === item.answer }))
  );
  // Cores e formas baralhadas, como no Kahoot.
  const hues = shuffle(Array.from({ length: HUE_COUNT }, (_, i) => i));

  optionsBox.innerHTML = "";
  opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.dataset.correct = opt.correct;
    btn.dataset.hue = hues[i];
    btn.innerHTML = '<span class="mark" aria-hidden="true"></span><span></span>';
    btn.lastChild.textContent = opt.text;
    btn.addEventListener("click", () => choose(btn));
    optionsBox.appendChild(btn);
  });

  questionTitle.focus({ preventScroll: true });
  iniciarCronometro();
}

function choose(btn) {
  if (locked) return;
  locked = true;
  pararCronometro();

  const item = QUESTIONS[current];
  const isCorrect = btn.dataset.correct === "true";
  if (isCorrect) score++;
  else missed.push(current);

  optionsBox.querySelectorAll(".option").forEach((o) => {
    o.disabled = true;
    // A forma (e a cor) mudam sozinhas: o CSS troca o símbolo
    // pela marca de certo/errado através de .is-correct / .is-wrong.
    if (o.dataset.correct === "true") o.classList.add("is-correct");
    else if (o === btn) o.classList.add("is-wrong");
    else o.classList.add("is-dim");
  });

  feedback.innerHTML = "";
  const title = document.createElement("strong");
  title.className = isCorrect ? "good" : "bad";
  title.textContent = isCorrect ? "Certo!" : "Não é bem assim.";
  const why = document.createElement("p");
  why.textContent = item.why;
  feedback.append(title, why);

  setLevel(current + 1);
  nextBtn.hidden = false;
  nextBtn.focus();
}

function next() {
  if (current < TOTAL - 1) {
    current++;
    renderQuestion();
  } else {
    finish();
  }
}

function finish() {
  show("result");

  const pct = score / TOTAL;
  let title, msg;
  if (pct === 1) {
    title = "Nível máximo!";
    msg = "Acertaste em tudo. Sabes bem o que está em jogo com a subida do mar.";
  } else if (pct >= 0.7) {
    title = "Muito bem!";
    msg = "Estás bem informado(a). Revê os pontos abaixo para fechar as dúvidas que ficaram.";
  } else if (pct >= 0.4) {
    title = "Já vais a meio da maré.";
    msg = "Tens uma boa base, mas ainda há temas para rever. Vê as respostas abaixo e tenta outra vez.";
  } else {
    title = "Ainda há muito para descobrir.";
    msg = "Não faz mal. Lê as explicações abaixo e repete o quiz para ver a diferença.";
  }

  $("result-title").textContent = title;
  $("score").textContent = score + " / " + TOTAL;
  $("result-msg").textContent = msg;

  const review = $("review");
  review.innerHTML = "";
  if (missed.length > 0) {
    const h = document.createElement("h3");
    h.textContent = "Perguntas a rever";
    const ul = document.createElement("ul");
    missed.forEach((idx) => {
      const it = QUESTIONS[idx];
      const li = document.createElement("li");
      const q = document.createElement("p");
      q.className = "q";
      q.textContent = it.q;
      const a = document.createElement("p");
      a.className = "a";
      a.textContent = "Resposta certa: " + it.options[it.answer];
      const w = document.createElement("p");
      w.textContent = it.why;
      li.append(q, a, w);
      ul.appendChild(li);
    });
    review.append(h, ul);
  }
}

// ------------------------------------------------------------
// Arranque
// ------------------------------------------------------------
buildTicks();
setLevel(0);
mostrarFoto(0); // fundo da introdução
show("intro");
scheduleIntro();

$("intro-skip").addEventListener("click", leaveIntro);
$("start-btn").addEventListener("click", startQuiz);
$("restart-btn").addEventListener("click", startQuiz);
nextBtn.addEventListener("click", next);
