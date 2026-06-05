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
  "rgba(255, 255, 255, 0.9)",  // branco
  "rgba(255, 228, 236, 0.85)"  // rosa bem claro
];

async function carregarDados() {
  try {
    const resposta = await fetch("data.json");
    const dados = await resposta.json();
    CONFIG = { ...CONFIG, ...dados };
  } catch (erro) {
    console.warn("Não foi possível carregar data.json.", erro);
  }

  registrarSW();
  iniciarApp();
}

function iniciarApp() {
  const audio = document.getElementById("audio");
  if (audio && CONFIG.musica) audio.src = CONFIG.musica;

  const fotoLogin = document.getElementById("couplePhoto");
  if (fotoLogin && CONFIG.fotos?.length) fotoLogin.src = CONFIG.fotos[0];

  verificarResetDiario();
  setInterval(verificarResetDiario, 30000);

  atualizarContador();
  setInterval(atualizarContador, 60000);

  if (window.innerWidth <= 600) {
   iniciarParticulasFofo(320); // celular: menos partículas
  } else {
    iniciarParticulasFofo(180); // PC: normal
  }

  setInterval(trocarFoto, 6000);


  renderHistorico();
  verificarCartaFinal();
  verificarInstallIOS();
}

function hoje() {
  return dataLocal();
}

function verificarResetDiario() {
  const diaAtual = hoje();

  if (progresso.dia !== diaAtual) {
    progresso.dia = diaAtual;
    progresso.usadas = 0;

    salvar();
    atualizarProgresso();

    const finalLetter = document.getElementById("finalLetter");
    if (finalLetter && !localStorage.getItem("carta_final_lida_pote_amor")) {
      finalLetter.classList.remove("show");
    }
  }
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
  renderDatasEspeciais();
  verificarAniversario();
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
  verificarResetDiario();

  if (progresso.usadas >= CONFIG.limite) {
    showToast("as próximas cartinhas liberam à meia-noite");
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
  data: dataLocal(),
  timestamp: Date.now(),
  hora: new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  })
});

  if (historico.length > 200) historico = historico.slice(0, 200);

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

let typeTimer = null;

function typeWriter(el, txt, i = 0, speed = 22) {
  if (typeTimer) {
    clearTimeout(typeTimer);
  }

  el.textContent = "";

  function escrever() {
    if (i < txt.length) {
      el.textContent += txt[i];
      i++;

      typeTimer = setTimeout(escrever, speed);
    }
  }

  escrever();
}

/* HISTÓRICO */
function renderHistorico() {
  const list = document.getElementById("histList");
  const count = document.getElementById("histCount");

  if (!list) return;

  if (count) {
    count.textContent = historico.length;
  }

  const nomesCategorias = {
    triste: "triste",
    feliz: "feliz",
    medo: "medo",
    carente: "carente",
    desanimada: "desanimada",
    forca: "força",
    motivacao: "motivação",
    insegura: "insegura",
    saudade: "saudade",
    lembrando: "lembrando de nós",
    teamo: "te amo",
    orgulho: "orgulho de você"
  };

  if (historico.length === 0) {
    list.innerHTML = `
      <div class="history-empty-card">
        <p>Ainda não tem nenhuma cartinha aberta.</p>
        <small>Escolha uma categoria acima para começar.</small>
      </div>
    `;
    return;
  }

  const grupos = agruparHistoricoPorDia(historico);

  list.innerHTML = grupos.map(([data, itens]) => {
    const qtd = itens.length;
    const textoQtd = qtd === 1 ? "1 cartinha" : `${qtd} cartinhas`;

    const abrirHoje = data === dataLocal() ? "open" : "";

    return `
      <details class="history-day" ${abrirHoje}>
        <summary class="history-day-head">
          <span>${rotuloDia(data)}</span>
          <small>${textoQtd}</small>
        </summary>

        <div class="history-day-list">
          ${itens.map(h => `
            <article class="history-item">
              <div class="history-top">
                <span class="history-cat">${nomesCategorias[h.tipo] || h.tipo}</span>
                <span class="history-time">${h.hora || ""}</span>
              </div>

              <p class="history-msg">${escapeHTML(h.msg)}</p>
            </article>
          `).join("")}
        </div>
      </details>
    `;
  }).join("");
}

function agruparHistoricoPorDia(lista) {
  const grupos = {};

  lista.forEach(item => {
    const chave = item.data || "antigas";

    if (!grupos[chave]) {
      grupos[chave] = [];
    }

    grupos[chave].push(item);
  });

  return Object.entries(grupos).sort(([dataA], [dataB]) => {
    if (dataA === "antigas") return 1;
    if (dataB === "antigas") return -1;

    return new Date(dataB + "T00:00:00") - new Date(dataA + "T00:00:00");
  });
}

function dataLocal(date = new Date()) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function rotuloDia(data) {
  if (data === "antigas") {
    return "cartinhas antigas";
  }

  const hojeData = dataLocal();

  const ontemDate = new Date();
  ontemDate.setDate(ontemDate.getDate() - 1);
  const ontemData = dataLocal(ontemDate);

  if (data === hojeData) return "hoje";
  if (data === ontemData) return "ontem";

  const d = new Date(data + "T00:00:00");

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function escapeHTML(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* CARTA FINAL */
function verificarCartaFinal() {
  const finalLetter = document.getElementById("finalLetter");
  if (!finalLetter) return;

  const cartaJaFoiLida =
    localStorage.getItem("carta_final_lida_pote_amor") === "true";

  finalLetter.classList.remove("show", "closed");

  // Primeira vez que ela completa as 10 cartinhas
  if (!cartaJaFoiLida && progresso.usadas >= CONFIG.limite) {
    finalLetter.classList.add("show");

    localStorage.setItem("carta_final_lida_pote_amor", "true");

    setTimeout(() => {
      finalLetter.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 350);

    return;
  }

  // Depois da primeira vez, a carta fica guardada/fechada
  if (cartaJaFoiLida) {
    finalLetter.classList.add("show", "closed");
  }
}

function abrirCartaFinalGuardada() {
  const finalLetter = document.getElementById("finalLetter");
  if (!finalLetter) return;

  finalLetter.classList.remove("closed");
  finalLetter.classList.add("show");

  setTimeout(() => {
    finalLetter.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

function guardarCartaFinal() {
  const finalLetter = document.getElementById("finalLetter");
  if (!finalLetter) return;

  finalLetter.classList.add("closed");
  finalLetter.classList.add("show");

  finalLetter.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
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

    const margem = window.innerWidth <= 600 ? 15 : 80;
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

    if (window.innerWidth <= 600) {
    wowInterval = iniciarParticulasFofo(180);
  } else {
    wowInterval = iniciarParticulasFofo(70);
  }

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

/* ══ DATAS ESPECIAIS ═════════════════════════════ */

function renderDatasEspeciais() {
  const wrap = document.getElementById("datesScroll");
  if (!wrap) return;

  const agora = new Date();
  agora.setHours(0, 0, 0, 0);

  const todas = [
    {
      nome: "Nosso dia",
      data: CONFIG.dataInicio,
      anual: true,
      destaque: true
    },
    ...(CONFIG.datasEspeciais || [])
  ];

  wrap.innerHTML = "";

  todas.forEach(item => {
    const proxima = calcularProximaData(item.data, item.anual);
    const diff = Math.ceil((proxima - agora) / 86400000);

    const card = document.createElement("div");
    card.className = "date-card";

    if (item.destaque) {
      card.classList.add("destaque");
    }

    card.innerHTML = `
      <span class="date-name">${item.nome}</span>
      <strong>${diff === 0 ? "é hoje!" : diff + " dias"}</strong>
      <small>${formatarData(proxima)}</small>
    `;

    wrap.appendChild(card);
  });
}

function calcularProximaData(dataTexto, anual) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const data = new Date(dataTexto + "T00:00:00");

  if (!anual) {
    return data;
  }

  let proxima = new Date(
    hoje.getFullYear(),
    data.getMonth(),
    data.getDate()
  );

  if (proxima < hoje) {
    proxima = new Date(
      hoje.getFullYear() + 1,
      data.getMonth(),
      data.getDate()
    );
  }

  return proxima;
}

function formatarData(data) {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

/* ══ TELA DE ANIVERSÁRIO ═════════════════════════ */

function verificarAniversario() {
  const hojeAtual = new Date();
  const hoje = `${String(hojeAtual.getMonth() + 1).padStart(2, "0")}-${String(hojeAtual.getDate()).padStart(2, "0")}`;

  const datas = CONFIG.datasEspeciais || [];

  const especialHoje = datas.find(item => {
    const data = new Date(item.data + "T00:00:00");
    const mesDia = `${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

    return item.destaque && item.anual && mesDia === hoje;
  });

  if (especialHoje) {
    abrirAniversario(especialHoje);
  }
}

function abrirAniversario(item) {
  const tela = document.getElementById("aniversarioScreen");
  const badge = document.getElementById("anivBadge");
  const numero = document.getElementById("anivNumero");
  const unidade = document.getElementById("anivUnidade");
  const msg = document.getElementById("anivMsg");

  if (!tela || !badge || !numero || !unidade || !msg) return;

  badge.textContent = item.nome;
  numero.textContent = "♥";
  unidade.textContent = "dia especial";
  msg.textContent = CONFIG.mensagemAniversario || "Hoje é um dia muito especial. Eu te amo muito.";

  tela.classList.add("show");
}

function fecharAniversario() {
  const tela = document.getElementById("aniversarioScreen");
  if (tela) tela.classList.remove("show");
}

/* =========================
   PWA / INSTALAÇÃO DO APP
========================= */

let deferredPrompt = null;
let novoWorker = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;

  if (localStorage.getItem("install_pote_dispensado") === "true") return;

  const banner = document.getElementById("installBanner");
  if (banner) {
    setTimeout(() => {
      banner.classList.add("show");
    }, 1800);
  }
});

function instalarApp() {
  const banner = document.getElementById("installBanner");

  if (!deferredPrompt) {
    showToast("se não aparecer, use adicionar à tela inicial");
    return;
  }

  deferredPrompt.prompt();

  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === "accepted") {
      showToast("app instalado com carinho");
    }

    deferredPrompt = null;

    if (banner) {
      banner.classList.remove("show");
    }
  });
}

function dispensarInstall() {
  localStorage.setItem("install_pote_dispensado", "true");

  const banner = document.getElementById("installBanner");
  if (banner) {
    banner.classList.remove("show");
  }
}

function verificarInstallIOS() {
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  if (!isIOS || isStandalone) return;
  if (localStorage.getItem("ios_install_pote_fechado") === "true") return;

  const banner = document.getElementById("iosBanner");
  if (banner) {
    setTimeout(() => {
      banner.classList.add("show");
    }, 2200);
  }
}

function fecharIos() {
  localStorage.setItem("ios_install_pote_fechado", "true");

  const banner = document.getElementById("iosBanner");
  if (banner) {
    banner.classList.remove("show");
  }
}

function registrarSW() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js")
    .then((registration) => {
      console.log("Service Worker registrado");

      registration.addEventListener("updatefound", () => {
        novoWorker = registration.installing;

        if (!novoWorker) return;

        novoWorker.addEventListener("statechange", () => {
          if (
            novoWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            mostrarBannerAtualizacao();
          }
        });
      });
    })
    .catch((err) => {
      console.warn("Service Worker falhou:", err);
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

function mostrarBannerAtualizacao() {
  const banner = document.getElementById("updateBanner");
  if (banner) {
    banner.classList.add("show");
  }
}

function atualizarApp() {
  if (!novoWorker) {
    window.location.reload();
    return;
  }

  novoWorker.postMessage({
    type: "SKIP_WAITING"
  });
}

carregarDados();
