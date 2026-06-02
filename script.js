let CONFIG = {
  senha: "1303",
  dataInicio: "2025-03-13",
  limite: 10,
  fotos: ["foto1.jpg", "foto2.jpg", "foto3.jpg", "foto4.jpg", "foto5.jpg", "foto6.jpg"],
  musica: "musica.mp3",
  mensagens: {}
};

let progresso = JSON.parse(localStorage.getItem("prog_pote_amor")) || { dia: null, usadas: 0 };
let historico = JSON.parse(localStorage.getItem("hist_pote_amor")) || [];
let frasesUsadas = JSON.parse(localStorage.getItem("frases_usadas_pote_amor")) || {};

let galIdx = 0;
let galTimer = null;
let touchStartX = 0;
let touchStartY = 0;
let touchDragging = false;
let fotoIdx = 0;
let eggClicks = 0;
let eggTimer = null;
let modoWOW = false;
let wowInterval = null;

const SWIPE_THRESHOLD = 40;
const CORES = [
  "rgba(255,200,209,0.9)",
  "rgba(255,240,245,0.9)",
  "rgba(255,255,255,0.9)"
];

async function carregarDados() {
  try {
    const resposta = await fetch("data.json");
    const dados = await resposta.json();
    CONFIG = { ...CONFIG, ...dados };
  } catch (erro) {
    console.warn("Não foi possível carregar data.json. Usando configuração padrão.", erro);
  }

  iniciarApp();
}

function iniciarApp() {
  const audio = document.getElementById("audio");
  if (audio && CONFIG.musica) audio.src = CONFIG.musica;

  const fotoLogin = document.getElementById("couplePhoto");
  if (fotoLogin && CONFIG.fotos?.length) fotoLogin.src = CONFIG.fotos[0];

  if (progresso.dia !== hoje()) {
    progresso.dia = hoje();
    progresso.usadas = 0;
    salvar();
  }

  atualizarContador();
  setInterval(atualizarContador, 60000);

  iniciarParticulasFofo();
  setInterval(trocarFoto, 6000);

  renderHistorico();
  verificarCartaFinal();
}

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function salvar() {
  localStorage.setItem("prog_pote_amor", JSON.stringify(progresso));
  localStorage.setItem("hist_pote_amor", JSON.stringify(historico));
  localStorage.setItem("frases_usadas_pote_amor", JSON.stringify(frasesUsadas));
}

/* TELAS */
function goTo(fromId, toId) {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);

  if (!from || !to) return;

  from.classList.add("leaving");

  setTimeout(() => {
    from.classList.remove("active", "leaving");
    from.classList.add("hidden");

    to.classList.remove("hidden");

    requestAnimationFrame(() => {
      to.classList.add("active");
      if (toId === "site") onSiteOpen();
    });
  }, 450);
}

function toggleEnvelope() {
  const envelope = document.getElementById("envelope");
  if (envelope) envelope.classList.toggle("open");
}

function verificarSenha() {
  const input = document.getElementById("senhaInput");
  if (!input) return;

  const valor = input.value.replace(/\D/g, "");

  if (valor === CONFIG.senha) {
    goTo("login", "site");
  } else {
    showToast("quase... tenta lembrar melhor");
    input.value = "";
  }
}

function onSiteOpen() {
  atualizarProgresso();
  renderHistorico();
  verificarCartaFinal();
  wowEffect();
}

/* CONTADOR */
function atualizarContador() {
  const inicio = new Date(CONFIG.dataInicio);
  const agora = new Date();
  const dias = Math.floor((agora - inicio) / 86400000);

  const el = document.getElementById("counterNum");
  if (!el) return;

  const atual = parseInt(el.textContent, 10) || 0;

  if (atual !== dias) {
    const step = Math.max(1, Math.ceil(Math.abs(dias - atual) / 30));
    const dir = dias > atual ? 1 : -1;
    let valor = atual;

    const timer = setInterval(() => {
      valor += dir * step;

      if ((dir > 0 && valor >= dias) || (dir < 0 && valor <= dias)) {
        valor = dias;
        clearInterval(timer);
      }

      el.textContent = valor;
    }, 30);
  }

  const meses = Math.floor(dias / 30);
  const horas = Math.floor((agora - inicio) / 3600000);
  const sub = document.getElementById("counterSub");

  if (sub) {
    if (dias < 30) sub.textContent = `${horas} horas de amor`;
    else sub.textContent = `${meses} ${meses === 1 ? "mês" : "meses"} de muito amor`;
  }
}

/* GALERIA */
function buildGallery() {
  const wrap = document.getElementById("galleryWrap");
  const dots = document.getElementById("galleryDots");

  if (!wrap || !dots) return;

  wrap.querySelectorAll(".gallery-slide").forEach(slide => slide.remove());
  dots.innerHTML = "";

  CONFIG.fotos.forEach((src, i) => {
    const slide = document.createElement("div");
    slide.className = "gallery-slide" + (i === 0 ? " active" : "");
    slide.dataset.idx = i;

    const img = document.createElement("img");
    img.className = "gallery-img";
    img.alt = "foto " + (i + 1);
    img.src = src;
    img.draggable = false;

    img.onerror = function () {
      slide.innerHTML = `
        <div class="gallery-placeholder">
          <span class="ph-num">${i + 1}</span>
          <span class="ph-lbl">foto${i + 1}.jpg</span>
        </div>`;
    };

    slide.appendChild(img);
    wrap.insertBefore(slide, wrap.querySelector(".gallery-arrows"));

    const dot = document.createElement("button");
    dot.className = "gallery-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", "foto " + (i + 1));
    dot.onclick = () => {
      galGoTo(i);
      resetGalTimer();
      dismissSwipeHint();
    };

    dots.appendChild(dot);
  });

  configurarSwipe(wrap);
  resetGalTimer();
}

function configurarSwipe(wrap) {
  if (wrap.dataset.swipeReady === "true") return;
  wrap.dataset.swipeReady = "true";

  wrap.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDragging = false;
  }, { passive: true });

  wrap.addEventListener("touchmove", e => {
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      touchDragging = true;
      e.preventDefault();
    }
  }, { passive: false });

  wrap.addEventListener("touchend", e => {
    if (!touchDragging) return;

    const dx = e.changedTouches[0].clientX - touchStartX;

    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      galleryMove(dx < 0 ? 1 : -1);
      resetGalTimer();
      dismissSwipeHint();
    }

    touchDragging = false;
  }, { passive: true });

  let mouseStart = null;

  wrap.addEventListener("mousedown", e => {
    mouseStart = e.clientX;
  });

  wrap.addEventListener("mouseup", e => {
    if (mouseStart === null) return;

    const dx = e.clientX - mouseStart;

    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      galleryMove(dx < 0 ? 1 : -1);
      resetGalTimer();
    }

    mouseStart = null;
  });
}

function resetGalTimer() {
  if (galTimer) clearInterval(galTimer);
  galTimer = setInterval(() => galleryMove(1), 5000);
}

function galleryMove(dir) {
  if (!CONFIG.fotos.length) return;
  galGoTo((galIdx + dir + CONFIG.fotos.length) % CONFIG.fotos.length);
}

function galGoTo(idx) {
  if (idx === galIdx) return;

  const slides = document.querySelectorAll(".gallery-slide");
  const dots = document.querySelectorAll(".gallery-dot");

  if (!slides.length || !dots.length) return;

  slides[galIdx]?.classList.remove("active");
  slides[galIdx]?.classList.add("prev");
  dots[galIdx]?.classList.remove("active");

  const oldIdx = galIdx;
  setTimeout(() => slides[oldIdx]?.classList.remove("prev"), 700);

  galIdx = idx;

  slides[galIdx]?.classList.add("active");
  dots[galIdx]?.classList.add("active");
}

function dismissSwipeHint() {
  const hint = document.getElementById("swipeHint");
  if (hint) hint.style.display = "none";
}

/* PROGRESSO */
function atualizarProgresso() {
  const text = document.getElementById("progText");
  const fill = document.getElementById("progFill");

  if (text) text.textContent = `${progresso.usadas}/${CONFIG.limite}`;
  if (fill) fill.style.width = `${(progresso.usadas / CONFIG.limite) * 100}%`;
}

/* MENSAGENS */
function openMsg(tipo) {
  if (progresso.usadas >= CONFIG.limite) {
    showToast("volta amanhã, lindinha");
    return;
  }

  const lista = CONFIG.mensagens[tipo];
  if (!lista || !lista.length) return;

  if (!frasesUsadas[tipo]) frasesUsadas[tipo] = [];

  let disponiveis = lista.filter(msg => !frasesUsadas[tipo].includes(msg));

  if (!disponiveis.length) {
    showToast("você já abriu todas dessa categoria");
    return;
  }

  const msg = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  frasesUsadas[tipo].push(msg);

  const disp = document.getElementById("msgDisplay");
  const label = document.getElementById("msgLabel");
  const text = document.getElementById("msgText");

  if (!disp || !label || !text) return;

  disp.classList.remove("show");
  void disp.offsetWidth;
  disp.classList.add("show");

  label.textContent = tipo;
  text.textContent = "";

  typeWriter(text, msg);

  disp.scrollIntoView({ behavior: "smooth", block: "center" });

  historico.unshift({
    tipo,
    msg,
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  });

  if (historico.length > 30) historico = historico.slice(0, 30);

  progresso.usadas++;
  salvar();
  atualizarProgresso();
  renderHistorico();
  verificarCartaFinal();
  spawnBurst();
}

function closeMsg() {
  const msg = document.getElementById("msgDisplay");
  if (msg) msg.classList.remove("show");
}

function typeWriter(el, txt, i = 0, speed = 22) {
  if (i < txt.length) {
    el.textContent += txt[i];
    setTimeout(() => typeWriter(el, txt, i + 1, speed), speed);
  }
}

/* HISTÓRICO */
function renderHistorico() {
  const list = document.getElementById("histList");
  if (!list) return;

  if (historico.length === 0) {
    list.innerHTML = '<p class="history-empty">Ainda não tem nenhuma... escolha uma categoria acima!</p>';
    return;
  }

  list.innerHTML = historico.map(h => `
    <div class="history-item">
      <div class="history-cat">${h.tipo} · ${h.hora || ""}</div>
      <div class="history-msg">${h.msg}</div>
    </div>
  `).join("");
}

/* CARTA FINAL */
function verificarCartaFinal() {
  const finalLetter = document.getElementById("finalLetter");
  if (!finalLetter) return;

  if (progresso.usadas >= CONFIG.limite) {
    finalLetter.classList.add("show");
  }
}

/* MÚSICA */
function toggleMusic() {
  const audio = document.getElementById("audio");
  const btn = document.getElementById("musicBtn");
  const label = document.getElementById("musicLabel");
  const restartBtn = document.getElementById("restartMusicBtn");

  if (!audio || !btn || !label || !restartBtn) return;

  if (audio.paused) {
    audio.play().catch(() => showToast("adicione o arquivo musica.mp3"));

    btn.classList.add("playing");
    restartBtn.classList.remove("escondido");
    restartBtn.classList.add("playing");

    label.textContent = "pausar musiquinha";
  } else {
    audio.pause();

    btn.classList.remove("playing");

    label.textContent = "tocar musiquinha";
  }
}

function reiniciarMusica() {
  const audio = document.getElementById("audio");
  const btn = document.getElementById("musicBtn");
  const label = document.getElementById("musicLabel");
  const restartBtn = document.getElementById("restartMusicBtn");

  if (!audio || !btn || !label || !restartBtn) return;

  audio.currentTime = 0;
  audio.play().catch(() => showToast("adicione o arquivo musica.mp3"));

  btn.classList.add("playing");
  restartBtn.classList.remove("escondido");
  restartBtn.classList.add("playing");

  label.textContent = "pausar musiquinha";
}

/* SEGREDINHO */
function easterEggHint() {
  eggClicks++;
  clearTimeout(eggTimer);

  eggTimer = setTimeout(() => {
    eggClicks = 0;
  }, 1500);

  if (eggClicks >= 5) {
    eggClicks = 0;
    openEgg();
  }
}

function openEgg() {
  const egg = document.getElementById("easterEgg");
  const stars = document.getElementById("eggStars");

  if (!egg || !stars) return;

  egg.classList.add("show");
  stars.innerHTML = "";

  for (let i = 0; i < 40; i++) {
    const s = document.createElement("div");
    s.className = "egg-star";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.animationDelay = Math.random() * 2 + "s";
    s.style.width = s.style.height = 4 + Math.random() * 6 + "px";
    stars.appendChild(s);
  }

  wowEffect();
}

function closeEgg() {
  const egg = document.getElementById("easterEgg");
  if (egg) egg.classList.remove("show");
}

/* PARTÍCULAS */
function iniciarParticulasFofo(intervalo = 180) {
  return setInterval(() => {
    const p = document.createElement("div");
    p.className = "particula";

    const size = Math.random() * 10 + 6;
    p.style.width = size + "px";
    p.style.height = size + "px";

    const margem = 80;
    const larguraUtil = Math.max(window.innerWidth - margem * 2, 50);
    p.style.left = margem + Math.random() * larguraUtil + "px";

    const duracao = Math.random() * 6 + 6;
    p.style.animationDuration = duracao + "s";

    const cor = CORES[Math.floor(Math.random() * CORES.length)];
    p.style.background = cor;

    if (modoWOW) {
      p.style.boxShadow = `0 0 14px ${cor}`;
      p.style.opacity = Math.random() * 0.8 + 0.5;
      p.style.filter = "blur(0.15px)";
    } else {
      p.style.boxShadow = `0 0 8px ${cor}`;
      p.style.opacity = Math.random() * 0.5 + 0.3;
      p.style.filter = "blur(0.25px)";
    }

    document.body.appendChild(p);

    setTimeout(() => p.remove(), duracao * 1000);
  }, intervalo);
}

function wowEffect() {
  modoWOW = true;

  if (wowInterval) clearInterval(wowInterval);

  wowInterval = iniciarParticulasFofo(70);

  setTimeout(() => {
    modoWOW = false;
    clearInterval(wowInterval);
    wowInterval = null;
  }, 4000);
}

function spawnBurst() {
  wowEffect();
}

/* TOAST */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;

  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => t.classList.remove("show"), 2800);
}

/* FOTO LOGIN */
function trocarFoto() {
  const img = document.getElementById("couplePhoto");
  if (!img || !CONFIG.fotos.length) return;

  img.classList.add("fading");

  setTimeout(() => {
    fotoIdx = (fotoIdx + 1) % CONFIG.fotos.length;
    img.src = CONFIG.fotos[fotoIdx];
    img.classList.remove("fading");
  }, 400);
}

carregarDados();
