// ------------------------------------------------------------
// Cena 3D — cenário "Camels Respite" + título 3D "welcome"
// ------------------------------------------------------------
// camels_respite.glb            cenário principal, com animação de 8,3 s
// 3d_text_model_-_welcome.glb  título 3D, só no ecrã de início
//
// Os dois modelos são do Sketchfab (ver a atribuição no index.html).
// three.js é carregado de ./vendor/ (sem CDN). Se o WebGL falhar,
// se um dos ficheiros não carregar, ou se a página for aberta em
// file://, o quiz continua com o desenho em CSS (data-ocean="off").
//
// O quiz fala com a cena por eventos:
//   quiz:screen   { detail: { screen: "intro" | "start" | "quiz" | "result" } }
//   quiz:progress { detail: { level: 0..1 } }
// E avisa com "cena:pronta" quando o cenário (e o título) já estão montados,
// para o ecrã de introdução poder passar sozinha ao quiz.
// ------------------------------------------------------------

import * as THREE from "three";
import { GLTFLoader } from "./vendor/three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_SCENE = "./camels_respite.glb";
const MODEL_TITLE = "./3d_text_model_-_welcome.glb";

const html = document.documentElement;
const canvas = document.getElementById("ocean-canvas");
const statusEl = document.getElementById("ocean-status");

// Céu de deserto, usado como cor de fundo e de ambiente.
const DUNE_SKY = 0xdcc39a;
const DUNE_HAZE = 0xefd9b4;
const DUNE_HORIZON = 0xe4c79c;
const DUNE_SAND = 0xc9a877;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ------------------------------------------------------------
// Parâmetros (ajustáveis em runtime com o parâmetro "debug" na URL)
// ------------------------------------------------------------
const FRAME = {
  fov: 42,
  azim: 0, // 0 = câmara à frente (+Z), em radianos
  elev: 0.38, // elevação da câmara (maior = vista mais aérea)
  dist: 0.85, // distância = 1 encaixa o conteúdo; acima disso afasta
  fitW: 0.52, // margem lateral
  fitD: 0.52, // margem de profundidade
  lookY: 0.0, // alvo, como fracção da altura do conteúdo
  lookZ: 0, // alvo em Z, como fracção da profundidade
  // Empurra o cenário no ecrã: positivo = para a direita, para baixo.
  // Como o cartão tapa a zona central, o cenário fica melhor visível
  // nas margens se for para a direita e para baixo.
  panX: 0.18,
  panY: 0.1,
  // O "voar" exagerado vinha da deriva: com o cenário já deslocado
  // para a direita, um balanço forte dava a ideia de movimento rápido.
  drift: 0.5, // amplitude do movimento ambiente (0 desliga)
};

const TITLE = {
  dist: 30, // distância à câmara
  size: 0.3, // altura do título como fracção da altura do ecrã
  offsetX: 0, // desvio lateral, em frações da largura visível
  offsetY: 0.06, // desvio vertical (o botão fica por baixo)
  spin: 0.04, // rotação de vaivém (radianos)
  float: 0.3, // oscilação vertical
};

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
let renderer = null;
let scene = null;
let camera = null;
let clock = null;
let mixer = null;

let pivot = null; // conteúdo centrado, para o enquadramento
let contentBox = new THREE.Box3();
let contentCenter = new THREE.Vector3();
let sceneScale = 10; // altura do conteúdo, para escalar o movimento
let titleGroup = null; // filho da câmara
let titleMats = [];
let titleBox = new THREE.Box3();
let titleTarget = 0; // 1 = visível, 0 = escondido
let titleShown = 0; // valor suavizado
let titleBaseY = 0;
let currentScreen = "intro";

let targetLevel = 0; // 0..1, vindo do quiz
let shownLevel = 0;
let clockTime = 0;
let needsRender = true;
let disposed = false;
let rafId = 0;

const lookTarget = new THREE.Vector3();
const desiredPos = new THREE.Vector3();
const VIEW_DIR = new THREE.Vector3();

// ------------------------------------------------------------
// Fallback
// ------------------------------------------------------------
function turnOff(message) {
  stop();
  html.setAttribute("data-ocean", "off");
  if (message) {
    if (statusEl) statusEl.textContent = message;
    console.warn("[cena 3D] " + message);
  }
  // O ecrã de introdução não pode ficar à espera de uma cena que não vem.
  document.dispatchEvent(new CustomEvent("cena:pronta"));
  disposeScene();
}

function setStatus(text, progress) {
  if (!statusEl) return;
  if (text) statusEl.textContent = text;
  if (progress === undefined) statusEl.style.removeProperty("--progress");
  else statusEl.style.setProperty("--progress", Math.round(progress * 100) + "%");
}

function disposeScene() {
  if (!scene) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  scene.traverse((obj) => {
    if (obj.geometry) geometries.add(obj.geometry);
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of list) materials.add(m);
    }
  });
  for (const m of materials) {
    for (const key of Object.keys(m)) {
      const value = m[key];
      if (value && value.isTexture) textures.add(value);
    }
  }
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
  scene.clear();
  scene = null;
}

function stop() {
  disposed = true;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}

// ------------------------------------------------------------
// Céu de deserto (fundo + ambiente)
// ------------------------------------------------------------
function buildSky() {
  const W = 32;
  const H = 128;
  const data = new Float32Array(W * H * 4);
  const stops = [
    { at: 0.0, hex: 0xcfe4ea }, // zénite: azul pálido
    { at: 0.34, hex: DUNE_SKY },
    { at: 0.5, hex: DUNE_HORIZON },
    { at: 0.56, hex: DUNE_HAZE },
    { at: 0.72, hex: DUNE_SAND },
    { at: 1.0, hex: 0x8a6f4e },
  ];

  const from = new THREE.Color();
  const to = new THREE.Color();
  for (let y = 0; y < H; y++) {
    // No mapeamento equirrectangular do three.js v=1 é o zénite.
    const v = 1 - y / (H - 1);
    let i = 0;
    while (i < stops.length - 2 && v > stops[i + 1].at) i++;
    const s0 = stops[i];
    const s1 = stops[i + 1];
    const t = THREE.MathUtils.clamp((v - s0.at) / (s1.at - s0.at), 0, 1);
    from.setHex(s0.hex);
    to.setHex(s1.hex);
    from.lerp(to, t);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      data[o] = from.r;
      data[o + 1] = from.g;
      data[o + 2] = from.b;
      data[o + 3] = 1;
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Chão de areia que alarga o mapa do modelo até cobrir o ecrã.
// Sem isto, a vista aérea olha para fora do terreno e aparece o
// vazio preto por baixo.
let groundPlane = null;

function buildGround() {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2); // plano na horizontal, virado para cima
  const mat = new THREE.MeshStandardMaterial({
    color: DUNE_SAND,
    roughness: 1,
    metalness: 0,
  });
  groundPlane = new THREE.Mesh(geo, mat);
  groundPlane.name = "Ground";
}

// ------------------------------------------------------------
// Carregamento com progresso (os ficheiros são grandes)
// ------------------------------------------------------------
async function fetchModel(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(received / total, received, total);
  }

  return { buffer: await new Blob(chunks).arrayBuffer(), received, total };
}

function parseModel(buffer) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, "", resolve, reject);
  });
}

// ------------------------------------------------------------
// Enquadramento
// ------------------------------------------------------------
function fitCamera() {
  if (!camera) return;

  camera.fov = FRAME.fov;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const size = new THREE.Vector3();
  contentBox.getSize(size);
  // Referência de escala: o movimento ambiente é proporcional ao
  // tamanho do cenário, para ficar igual com modelos de tamanho diferente.
  sceneScale = Math.max(size.y, size.x * 0.4, 1);

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const fitWidth = (size.x * FRAME.fitW) / Math.tan(hFov / 2);
  const fitDepth = (size.z * FRAME.fitD) / Math.tan(vFov / 2);
  const dist = Math.max(fitWidth, fitDepth) * FRAME.dist;

  lookTarget.set(0, size.y * FRAME.lookY, size.z * FRAME.lookZ);

  const ce = Math.cos(FRAME.elev);
  VIEW_DIR.set(Math.sin(FRAME.azim) * ce, Math.sin(FRAME.elev), Math.cos(FRAME.azim) * ce).normalize();

  // O chão acompanha a distância da câmara: quanto mais longe, mais
  // areia é preciso para não aparecer o vazio nas margens.
  if (groundPlane) {
    const reach = Math.max(size.x, size.z) * 1.2 + dist * 2.4;
    // contentBox está no referencial original do GLB; o conteúdo foi
    // depois centrado em -center, por isso subtraímos esse mesmo valor.
    groundPlane.position.set(0, contentBox.min.y - contentCenter.y - 1, 0);
    groundPlane.scale.set(reach, 1, reach);
  }
  // A neblina também segue a distância, para o horizonte ficar à mesma
  // distância de todos os lado quando se muda o tamanho do ecrã.
  if (scene.fog) {
    scene.fog.near = dist * 0.9;
    scene.fog.far = dist * 3.4;
  }

  desiredPos.copy(lookTarget).addScaledVector(VIEW_DIR, dist);
  camera.position.copy(desiredPos);
  camera.lookAt(lookTarget);

  // Empurro da vista: somar o mesmo deslocamento à câmara e ao alvo
  // desloca a imagem no ecrã sem rodar a câmara. Feito depois do
  // lookAt para o referencial estar já correcto.
  applyPan();

  layoutTitle();
  needsRender = true;
}

// Desloca câmara e alvo em conjunto, em unidades do mundo.
function applyPan() {
  if (!FRAME.panX && !FRAME.panY) return;
  const size = new THREE.Vector3();
  contentBox.getSize(size);
  const dist = camera.position.distanceTo(lookTarget);
  const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const visW = visH * camera.aspect;
  // Eixos da câmara: tiramos-nos do quaternião, que está sempre
  // actualizado (a matrixWorld só é recalculada no render).
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  // O conteúdo move-se no ecrã ao contrário do movimento da câmara:
  // panX > 0 => câmara para a esquerda => cenário para a direita.
  // panY > 0 => câmara para cima       => cenário para baixo.
  const offset = new THREE.Vector3()
    .addScaledVector(right, -FRAME.panX * visW)
    .addScaledVector(up, FRAME.panY * visH);
  camera.position.add(offset);
  lookTarget.add(offset);
  desiredPos.add(offset);
}

// O título vive no espaço da câmara, para ficar sempre virado para nós.
function layoutTitle() {
  if (!titleGroup || !camera) return;
  const size = new THREE.Vector3();
  titleBox.getSize(size);
  const visibleHeight = 2 * TITLE.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const visibleWidth = visibleHeight * camera.aspect;
  titleGroup.position.set(TITLE.offsetX * visibleWidth, TITLE.offsetY * visibleHeight, -TITLE.dist);
  titleGroup.userData.baseScale = (TITLE.size * visibleHeight) / Math.max(size.y, 0.001);
  titleBaseY = titleGroup.position.y;
}

function resize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  fitCamera();
}

// ------------------------------------------------------------
// Frame
// ------------------------------------------------------------
function renderFrame() {
  const dt = clock ? Math.min(clock.getDelta(), 0.05) : 0;
  clockTime += dt;

  shownLevel += (targetLevel - shownLevel) * (1 - Math.exp(-dt * 2.4));
  titleShown += (titleTarget - titleShown) * (1 - Math.exp(-dt * 3.2));

  const calm = reduceMotion.matches;
  const drift = calm ? 0 : FRAME.drift;

  if (mixer) mixer.update(dt);

  if (pivot) {
    // O progresso do quiz eleva ligeiramente o ponto de vista.
    const bob = calm ? 0 : Math.sin(clockTime * 0.21) * 0.006 * sceneScale * drift;
    pivot.position.y = shownLevel * 0.05 * sceneScale + bob;
    if (!calm) {
      pivot.rotation.y = Math.sin(clockTime * 0.06) * 0.012 * drift;
      pivot.position.x = Math.sin(clockTime * 0.043 + 0.6) * 0.02 * sceneScale * drift;
    }
  }

  if (camera && desiredPos.lengthSq() > 0 && !calm) {
    camera.position.x = desiredPos.x + Math.sin(clockTime * 0.09) * 0.028 * sceneScale * drift;
    camera.position.y = desiredPos.y + Math.sin(clockTime * 0.071 + 1.7) * 0.016 * sceneScale * drift;
    camera.lookAt(lookTarget);
  }

  if (titleGroup) {
    const on = titleShown > 0.002;
    titleGroup.visible = on;
    if (on) {
      const base = titleGroup.userData.baseScale || 1;
      const pop = 0.86 + 0.14 * titleShown;
      titleGroup.scale.setScalar(base * pop);
      titleGroup.position.y = titleBaseY + (calm ? 0 : Math.sin(clockTime * 0.7) * TITLE.float);
      titleGroup.rotation.y = calm ? 0 : Math.sin(clockTime * 0.4) * TITLE.spin;
      for (const m of titleMats) {
        m.opacity = titleShown;
        m.transparent = titleShown < 0.999;
      }
    }
  }

  renderer.render(scene, camera);
  needsRender = false;
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (disposed || !renderer) return;
  if (document.hidden) return;
  if (reduceMotion.matches && !needsRender) return;
  renderFrame();
}

// ------------------------------------------------------------
// Arranque
// ------------------------------------------------------------
async function init() {
  if (!canvas) return;

  // Abrir o ficheiro com file:// bloqueia o fetch dos GLB.
  if (window.location.protocol === "file:") {
    turnOff("O cenário 3D precisa de um servidor local (ex.: python -m http.server). O quiz continua sem ele.");
    return;
  }

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (err) {
    turnOff("Este navegador não tem WebGL. O quiz continua com o desenho 2D.");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  const sky = buildSky();
  scene.background = sky;
  scene.environment = sky;
  scene.environmentIntensity = 0.55;
  // A neblina é o que faz o chão encontrarem o horizonte sem se ver
  // a aresta: o modelo traz o terreno e uma cúpula, e nenhum dos dois
  // chega aos cantos do enquadramento.
  scene.fog = new THREE.Fog(DUNE_HAZE, 90, 340);

  camera = new THREE.PerspectiveCamera(FRAME.fov, 1, 0.1, 3000);
  scene.add(camera); // para o título poder ser filho da câmara
  resize();

  // Luz só para dar volume ao que a cúpula do ambiente não ilumina.
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(-0.6, 1, 0.45).multiplyScalar(120);
  scene.add(sun);
  const bounce = new THREE.DirectionalLight(0xd9b98a, 0.45);
  bounce.position.set(0.5, -0.3, -0.8).multiplyScalar(120);
  scene.add(bounce);

  // ---------- cenário ----------
  let gltf;
  try {
    setStatus("A carregar o cenário 3D… 0 %", 0);
    const { buffer } = await fetchModel(MODEL_SCENE, (p, got, total) => {
      setStatus("A carregar o cenário 3D… " + Math.round(p * 100) + " %", p);
      console.debug("[cena 3D]", Math.round(got / 1048576) + " MB de", Math.round(total / 1048576) + " MB");
    });
    setStatus("A preparar o cenário 3D…", undefined);
    gltf = await parseModel(buffer);
  } catch (err) {
    console.error("[cena 3D] Falha ao carregar o cenário:", err);
    turnOff("Não foi possível carregar o cenário 3D. O quiz continua com o desenho 2D.");
    return;
  }

  // A animação do GLB (8,3 s) dá o movimento à camela.
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(gltf.scene);
    const action = mixer.clipAction(gltf.animations[0]);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
  }

  // O caixa de alinhamento ignora a cúpula do ambiente: interessa
  // enquadrar os camelos, não a esfera de fundo.
  const isEnvironment = (obj) => {
    let node = obj;
    while (node) {
      if (/environment/i.test(node.name || "")) return true;
      node = node.parent;
    }
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    return !!(mat && /environment/i.test(mat.name || ""));
  };
  contentBox.makeEmpty();
  const tmpBox = new THREE.Box3();
  gltf.scene.updateWorldMatrix(true, true);
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh || isEnvironment(obj)) return;
    tmpBox.setFromObject(obj);
    if (!tmpBox.isEmpty()) contentBox.union(tmpBox);
  });
  if (contentBox.isEmpty()) contentBox.setFromObject(gltf.scene);

  const center = new THREE.Vector3();
  contentBox.getCenter(center);
  contentCenter.copy(center);
  const centered = new THREE.Group();
  centered.position.copy(center).negate();
  centered.add(gltf.scene);

  pivot = new THREE.Group();
  pivot.add(centered);
  scene.add(pivot);

  buildGround();
  pivot.add(groundPlane); // o chão sobe e desce com o terreno
  fitCamera();
  clock = new THREE.Clock();
  renderFrame();

  html.setAttribute("data-ocean", "ready");
  setStatus("Cenário 3D carregado.", undefined);
  if (statusEl) statusEl.classList.add("is-done");

  if (new URLSearchParams(location.search).has("debug")) exposeDebug();

  rafId = requestAnimationFrame(tick);

  // ---------- título 3D ----------
  // Carregado depois do cenário para não atrasar a primeira imagem.
  loadTitle();
}

async function loadTitle() {
  let gltf;
  try {
    const { buffer } = await fetchModel(MODEL_TITLE, (p, got, total) => {
      if (html.getAttribute("data-ocean") === "ready") {
        setStatus("A carregar o título 3D… " + Math.round(p * 100) + " %", p);
      }
      console.debug("[cena 3D] título", Math.round(got / 1048576) + " MB de", Math.round(total / 1048576) + " MB");
    });
    if (disposed) return;
    setStatus("A preparar o título 3D…", undefined);
    gltf = await parseModel(buffer);
  } catch (err) {
    console.error("[cena 3D] Falha ao carregar o título:", err);
    // O título é um extra: o cenário continua a funcionar sem ele.
    setStatus("Não foi possível carregar o título 3D.", undefined);
    finishTitle();
    return;
  }
  if (disposed) return;

  titleBox.setFromObject(gltf.scene);
  titleGroup = new THREE.Group();
  // O texto é plano e olha para +Z; a câmara olha para -Z.
  // A geometria não está centrada no próprio origen: corrigimos para
  // o título ficar mesmo ao centro do ecrã.
  const titleCenter = new THREE.Vector3();
  titleBox.getCenter(titleCenter);
  gltf.scene.position.sub(titleCenter);
  titleGroup.add(gltf.scene);

  const list = Array.isArray(gltf.scene) ? [] : [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || list.includes(m)) continue;
      list.push(m);
      m.transparent = true;
      m.opacity = 0;
    }
  });
  titleMats = list;

  camera.add(titleGroup);
  layoutTitle();
  needsRender = true;

  // Só aparece se ainda estivermos no ecrã de introdução.
  titleTarget = currentScreen === "intro" ? 1 : 0;
  if (statusEl) statusEl.classList.toggle("is-done", titleTarget === 0);
  if (titleTarget) setStatus("Pronto.", undefined);
  finishTitle();
}

// Avisa o quiz de que a cena está montada (com ou sem título) para
// o ecrã de introdução poder avançar.
function finishTitle() {
  if (statusEl) statusEl.classList.add("is-done");
  document.dispatchEvent(new CustomEvent("cena:pronta"));
}

// ------------------------------------------------------------
// Handle de afinação (só com o parâmetro "debug" na URL)
// ------------------------------------------------------------
function exposeDebug() {
  const debug = {
    renderer, scene, camera, pivot, contentBox, FRAME, TITLE,
    get mixer() { return mixer; },
    get titleGroup() { return titleGroup; },
    get titleBox() { return titleBox; },
    setLevel: (v) => { targetLevel = v; },
    get level() { return shownLevel; },
    setTitle: (v) => { titleTarget = v; },
    configure: (frame, title) => {
      if (frame) Object.assign(FRAME, frame);
      if (title) Object.assign(TITLE, title);
      fitCamera();
      return { frame: FRAME, title: TITLE };
    },
    // Estatísticas do frame actual, para afinar sem inspecção visual.
    sample: () => {
      renderFrame();
      const src = renderer.domElement;
      const W = 80, H = 45;
      const tmp = document.createElement("canvas");
      tmp.width = W;
      tmp.height = H;
      const ctx = tmp.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(src, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const hex = (acc, n) =>
        "#" +
        acc
          .map((v) => Math.round(v / n).toString(16).padStart(2, "0"))
          .join("");
      const rowHex = (y) => {
        const a = [0, 0, 0];
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          a[0] += d[i]; a[1] += d[i + 1]; a[2] += d[i + 2];
        }
        return hex(a, W);
      };
      let sl = 0, sl2 = 0;
      const n = W * H;
      for (let i = 0; i < d.length; i += 4) {
        const l = lum(i);
        sl += l;
        sl2 += l * l;
      }
      const colHex = (xx) => {
        const a = [0, 0, 0];
        for (let y = 0; y < H; y++) {
          const i = (y * W + xx) * 4;
          a[0] += d[i]; a[1] += d[i + 1]; a[2] += d[i + 2];
        }
        return hex(a, H);
      };
      // Centróide do conteúdo (pixéis escuros): diz onde o cenário
      // está realmente no ecrã, e não apenas como está centered.
      let cx = 0, cy = 0, cn = 0, pretos = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const l = lum((y * W + x) * 4);
          if (l < 26) pretos++;
          if (l < 90) { cx += x; cy += y; cn++; }
        }
      }
      return {
        buffer: src.width + "x" + src.height,
        desvioLuminancia: +Math.sqrt(Math.max(0, sl2 / n - (sl / n) ** 2)).toFixed(1),
        perfil: Array.from({ length: 15 }, (_, k) => Math.round((k * H) / 15) + ":" + rowHex(Math.round((k * H) / 15))),
        colunas: Array.from({ length: 9 }, (_, k) => Math.round((k * W) / 9) + ":" + colHex(Math.round((k * W) / 9))),
        escuros: cn + "px centroide x=" + (cn ? ((cx / cn / (W - 1)) * 100).toFixed(0) : "-") + "% y=" + (cn ? ((cy / cn / (H - 1)) * 100).toFixed(0) : "-") + "%",
        pretos: pretos + "px (" + ((pretos / n) * 100).toFixed(1) + "%)",
        info: debug.info(),
      };
    },
    info: () => {
      const size = new THREE.Vector3();
      contentBox.getSize(size);
      return {
        contentSize: size.toArray().map((n) => +n.toFixed(2)),
        dist: +camera.position.distanceTo(lookTarget).toFixed(2),
        cam: camera.position.toArray().map((n) => +n.toFixed(2)),
        look: lookTarget.toArray().map((n) => +n.toFixed(2)),
        titulo: titleGroup ? titleShown.toFixed(2) : "sem titulo",
        tris: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        texturas: renderer.info.memory.textures,
        geometrias: renderer.info.memory.geometries,
      };
    },
    // Confere se o conteúdo cabe no ecrã (a página não deve deslizar).
    layout: () => {
      const scr = document.querySelector(".screen:not([hidden])");
      const box = scr ? scr.getBoundingClientRect() : null;
      let over = null;
      if (scr) {
        for (const el of scr.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1) {
            over = (el.className || el.tagName) + " " + Math.round(r.bottom) + "/" + Math.round(r.right);
            break;
          }
        }
      }
      return {
        ecra: scr ? scr.id : "?",
        pagina: document.documentElement.scrollHeight + "/" + window.innerHeight,
        ecraBox: box ? Math.round(box.height) + "x" + Math.round(box.width) : "-",
        transborda: over || "nao",
      };
    },
    // Onde fica o título 3D no ecrã, em píxeis (para confirmar que
    // está centrado e não tapado pelo painel).
    titleScreen: () => {
      if (!titleGroup) return null;
      renderFrame();
      const box = new THREE.Box3().setFromObject(titleGroup);
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Vector3(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        );
        p.project(camera);
        pts.push(p);
      }
      const toPx = (v) => Math.round(((v.x + 1) / 2) * window.innerWidth);
      const toPy = (v) => Math.round(((1 - v.y) / 2) * window.innerHeight);
      const xs = pts.map(toPx);
      const ys = pts.map(toPy);
      const card = document.querySelector(".app");
      const cr = card ? card.getBoundingClientRect() : null;
      return {
        x: Math.min(...xs) + ".." + Math.max(...xs) + " de " + window.innerWidth,
        y: Math.min(...ys) + ".." + Math.max(...ys) + " de " + window.innerHeight,
        centro: Math.round((Math.min(...xs) + Math.max(...xs)) / 2) + " (centro " + Math.round(window.innerWidth / 2) + ")",
        visivel: +titleShown.toFixed(2),
        sobreCartao: cr ? Math.min(...xs) < cr.right && Math.max(...xs) > cr.left : null,
      };
    },
    // Confere se o texto do painel continua legível sobre a cena:
    // mede a cena por trás do cartão e calcula o contraste com a cor
    // do texto depois de aplicar o vidro.
    legibility: () => {
      renderFrame();
      const card = document.querySelector(".app");
      if (!card || getComputedStyle(document.documentElement).getPropertyValue("--glass") === "") return null;
      const r = card.getBoundingClientRect();
      const src = renderer.domElement;
      const tmp = document.createElement("canvas");
      const W = 60;
      const H = Math.max(1, Math.round((W * r.height) / r.width));
      tmp.width = W;
      tmp.height = H;
      const ctx = tmp.getContext("2d", { willReadFrequently: true });
      // Recorta a zona do cartão e reduz para não pesar.
      ctx.drawImage(
        src,
        (r.left / window.innerWidth) * src.width,
        (r.top / window.innerHeight) * src.height,
        (r.width / window.innerWidth) * src.width,
        (r.height / window.innerHeight) * src.height,
        0, 0, W, H
      );
      const d = ctx.getImageData(0, 0, W, H).data;
      const lums = [];
      for (let i = 0; i < d.length; i += 4) {
        lums.push(
          (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        );
      }
      lums.sort((a, b) => a - b);
      const pct = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
      const cs = getComputedStyle(document.documentElement);
      const alpha = parseFloat(cs.getPropertyValue("--glass")) || 0.78;
      // O halo (.screen::after) cobre só a zona do texto, por isso
      // é ele que sustenta a legibilidade e não o cartão.
      const scrim = parseFloat(cs.getPropertyValue("--scrim")) || 0;
      // Alfa efectivo onde assenta o texto: as duas camadas somam-se.
      const overText = 1 - (1 - alpha) * (1 - scrim);
      // O vidro é branco (#F8FAF7) sobre a cena.
      const glassL = (0.2126 * 248 + 0.7152 * 250 + 0.0722 * 247) / 255;
      const textL = (() => {
        const c = new THREE.Color(getComputedStyle(document.body).color);
        return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      })();
      const ratio = (bg) => {
        const a = Math.max(bg, textL);
        const b = Math.min(bg, textL);
        return +(((a + 0.05) / (b + 0.05)).toFixed(2));
      };
      const blend = (scene) => overText * glassL + (1 - overText) * scene;
      return {
        cenario: {
          escuro: +pct(0.05).toFixed(3),
          medio: +pct(0.5).toFixed(3),
          claro: +pct(0.95).toFixed(3),
        },
        vidro: { cartao: alpha, halo: scrim, sobreOTexto: +overText.toFixed(2) },
        contraste: {
          piorCaso: ratio(blend(pct(0.05))),
          medio: ratio(blend(pct(0.5))),
          melhorCaso: ratio(blend(pct(0.95))),
        },
        minimoAA: 4.5,
      };
    },
    // Cor média e tamanho de cada textura, para controlar a VRAM.
    probeTextures: () => {
      const out = [];
      const seen = new Set();
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          for (const [k, tex] of Object.entries({
            map: m.map, normal: m.normalMap, rough: m.roughnessMap,
            emis: m.emissiveMap, ao: m.aoMap, trans: m.transmissionMap,
          })) {
            if (!tex || seen.has(tex.uuid) || !tex.image) continue;
            seen.add(tex.uuid);
            out.push({
              mat: m.name, canal: k,
              tam: tex.image.width + "x" + tex.image.height,
              mip: !!tex.generateMipmaps,
              vramMB: +((tex.image.width * tex.image.height * 4 * (tex.generateMipmaps ? 1.33 : 1)) / 1048576).toFixed(1),
            });
          }
        }
      });
      return out;
    },
  };
  window.__ocean = debug;
}

// ------------------------------------------------------------
// Eventos
// ------------------------------------------------------------
document.addEventListener("quiz:screen", (e) => {
  const name = e.detail && e.detail.screen;
  if (name) currentScreen = name;
  // O título 3D só existe no ecrã de introdução.
  titleTarget = name === "intro" ? 1 : 0;
  if (statusEl) statusEl.classList.add("is-done");
  if (reduceMotion.matches) needsRender = true;
});

document.addEventListener("quiz:progress", (e) => {
  const level = e.detail && typeof e.detail.level === "number" ? e.detail.level : 0;
  targetLevel = THREE.MathUtils.clamp(level, 0, 1);
  if (reduceMotion.matches) needsRender = true;
});

window.addEventListener("resize", () => {
  if (renderer) resize();
});

reduceMotion.addEventListener("change", () => {
  needsRender = true;
});

window.addEventListener("pagehide", stop);

// ------------------------------------------------------------
init().catch((err) => {
  console.error("[cena 3D] Erro inesperado:", err);
  turnOff("O cenário 3D não pôde ser iniciado. O quiz continua com o desenho 2D.");
});
