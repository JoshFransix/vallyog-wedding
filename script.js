/* =========================================================
   EDIT YOUR DETAILS HERE
   ========================================================= */
const CONFIG = {
  // Ceremony start, Nigerian time (WAT, UTC+1)
  date: "2026-12-05T12:00:00+01:00",

  // RSVPs open WhatsApp with a ready-made message to this number.
  // International format, digits only — e.g. 2348012345678
  rsvpWhatsApp: "2340000000000",

  // Photos — put files in the photos/ folder with these names.
  // Missing files show a soft placeholder box instead.
  photos: [
    "photos/1.jpg",
    "photos/2.jpg",
    "photos/3.jpg",
    "photos/4.jpg",
    "photos/5.jpg",
    "photos/6.jpg",
  ],

  // Footer contacts
  contacts: {
    "Bride’s side": [
      { name: "Contact name", phone: "+234 000 000 0000" },
      { name: "Contact name", phone: "+234 000 000 0000" },
    ],
    "Groom’s side": [
      { name: "Contact name", phone: "+234 000 000 0000" },
      { name: "Contact name", phone: "+234 000 000 0000" },
    ],
  },

  venue: "Nze Festus Okpalachukwu Onodugo Compound, Agbelu Village, Akpo, Aguata LGA, Anambra State, Nigeria",
  eventTitle: "Oluebube & Onyedikachi — Traditional Marriage",
};

/* ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Envelope intro ---------- */
const intro = $("#intro");
const envelope = $("#envelope");
const seal = $("#seal");
const music = $("#music");
const musicBtn = $("#music-btn");
let musicAvailable = false; // becomes true once music/song.mp3 loads

function openInvitation() {
  if (envelope.classList.contains("open")) return;
  playMusic();

  if (reduceMotion) {
    finishIntro();
    return;
  }

  intro.classList.add("opening");
  seal.classList.add("pressed");
  tilt.settle = true; // ease the envelope back to flat while it opens

  // Each step starts once the previous movement has (nearly) settled,
  // so nothing jumps: seal → flap → card rises + petals pop → card flips
  // toward you and becomes the hero.
  const steps = [
    [350,  () => envelope.classList.add("open")],        // flap turns (1.3s)
    [1000, () => envelope.classList.add("flap-back")],   // flap is edge-on here
    [1200, () => {                                       // card rises (1.9s)
      envelope.classList.add("card-out");
      Petals.burst(envelope.getBoundingClientRect());
    }],
    [1700, () => Petals.rain(5)],
    [3150, flipCard],                                    // card flies out and flips (1.6s)
  ];
  steps.forEach(([t, fn]) => setTimeout(fn, t));
}

/* The card leaves the envelope, lifts toward the viewer, turns over and
   grows to fill the screen; its back is the hero's burgundy, so when it
   fades the page is simply there. */
function flipCard() {
  const card = $(".card", envelope);
  const r = card.getBoundingClientRect();

  const flipper = document.createElement("div");
  flipper.className = "flipper";
  Object.assign(flipper.style, {
    left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px",
  });
  flipper.innerHTML = `<div class="flip-front">${card.innerHTML}</div><div class="flip-back"></div>`;
  document.body.appendChild(flipper);
  card.style.visibility = "hidden";
  envelope.classList.add("away");

  const vw = window.innerWidth, vh = window.innerHeight;
  const dx = vw / 2 - (r.left + r.width / 2);
  const dy = vh / 2 - (r.top + r.height / 2);
  const sx = (vw / r.width) * 1.04, sy = (vh / r.height) * 1.04;
  const P = "perspective(2200px)";

  const anim = flipper.animate([
    { transform: `${P} translate3d(0,0,0) rotateY(0) rotateX(0) scale(1)` },
    { transform: `${P} translate3d(${dx * .5}px, ${dy * .5 - r.height * .1}px, 120px) rotateY(0) rotateX(8deg) scale(1.08)`, offset: .3 },
    { transform: `${P} translate3d(${dx}px, ${dy}px, 60px) rotateY(180deg) rotateX(0) scale(1.5)`, offset: .72 },
    { transform: `${P} translate3d(${dx}px, ${dy}px, 0) rotateY(180deg) rotateX(0) scale(${sx}, ${sy})` },
  ], { duration: 1600, easing: "cubic-bezier(.55, 0, .3, 1)", fill: "forwards" });

  anim.onfinish = () => {
    // the card covers the screen now, so drop the pink intro at once —
    // otherwise it would show through as the card fades
    intro.style.transition = "none";
    finishIntro();
    // Fade only the burgundy back face. Fading the whole flipper would
    // flatten its 3D and show the front face mirrored through it.
    $(".flip-front", flipper).style.visibility = "hidden";
    $(".flip-back", flipper).animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 900, delay: 150, easing: "ease", fill: "forwards",
    }).onfinish = () => flipper.remove();
  };
}

function finishIntro() {
  intro.classList.add("leaving");
  document.body.classList.remove("locked");
  document.body.classList.add("opened");
  window.scrollTo(0, 0);
  if (musicAvailable) musicBtn.hidden = false;
  setTimeout(() => { intro.remove(); tilt.stop = true; }, 1500);
}

seal.addEventListener("click", openInvitation);

/* ---------- Envelope tilt ----------
   The envelope leans gently toward the pointer (or with the phone's
   movement), and drifts on its own when nothing is moving it. */
const tilt = { x: 0, y: 0, tx: 0, ty: 0, active: 0, settle: false, stop: false };
const tiltEl = $("#env-tilt");

if (!reduceMotion) {
  intro.addEventListener("pointermove", (e) => {
    tilt.tx = ((e.clientY / window.innerHeight) - 0.5) * -14;
    tilt.ty = ((e.clientX / window.innerWidth) - 0.5) * 18;
    tilt.active = performance.now();
  });
  window.addEventListener("deviceorientation", (e) => {
    if (e.beta == null) return;
    tilt.tx = Math.max(-10, Math.min(10, (e.beta - 40) / 3));
    tilt.ty = Math.max(-12, Math.min(12, e.gamma / 2.5));
    tilt.active = performance.now();
  });

  (function tiltFrame(now) {
    if (tilt.stop) return;
    let tx = tilt.tx, ty = tilt.ty;
    if (tilt.settle) {
      tx = ty = 0;
    } else if (now - tilt.active > 2500) {
      // idle drift
      tx = Math.sin(now / 1700) * 4;
      ty = Math.sin(now / 2300) * 6;
    }
    tilt.x += (tx - tilt.x) * 0.06;
    tilt.y += (ty - tilt.y) * 0.06;
    tiltEl.style.setProperty("--rx", tilt.x.toFixed(2) + "deg");
    tiltEl.style.setProperty("--ry", tilt.y.toFixed(2) + "deg");
    tiltEl.style.setProperty("--shine", (50 - tilt.y * 4).toFixed(1) + "%");
    requestAnimationFrame(tiltFrame);
  })(performance.now());
}

/* ---------- Music ---------- */
music.addEventListener("loadedmetadata", () => {
  musicAvailable = true;
  if (document.body.classList.contains("opened")) musicBtn.hidden = false;
});

function playMusic() {
  if (!musicAvailable) return;
  music.volume = 0;
  music.play().then(() => {
    musicBtn.classList.add("playing");
    musicBtn.setAttribute("aria-label", "Pause music");
    fadeVolume(0.55, 2500);
  }).catch(() => {});
}

function fadeVolume(target, ms) {
  const start = music.volume;
  const t0 = performance.now();
  (function step(now) {
    const k = Math.min(1, (now - t0) / ms);
    music.volume = start + (target - start) * k;
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

musicBtn.addEventListener("click", () => {
  if (music.paused) {
    playMusic();
  } else {
    music.pause();
    musicBtn.classList.remove("playing");
    musicBtn.setAttribute("aria-label", "Play music");
  }
});

/* ---------- Countdown ---------- */
const target = new Date(CONFIG.date).getTime();
const cd = $("#countdown");
const units = {
  days: $('[data-unit="days"]', cd),
  hours: $('[data-unit="hours"]', cd),
  mins: $('[data-unit="mins"]', cd),
  secs: $('[data-unit="secs"]', cd),
};

function setUnit(el, value) {
  const v = String(value).padStart(2, "0");
  if (el.textContent === v) return;
  el.textContent = v;
  if (!reduceMotion) {
    el.classList.remove("tick");
    void el.offsetWidth; // restart animation
    el.classList.add("tick");
  }
}

function updateCountdown() {
  const diff = target - Date.now();
  if (diff <= 0) {
    cd.classList.add("done");
    cd.textContent = diff > -86400000 ? "Today is the day!" : "Happily married";
    clearInterval(timer);
    return;
  }
  setUnit(units.days, Math.floor(diff / 86400000));
  setUnit(units.hours, Math.floor(diff / 3600000) % 24);
  setUnit(units.mins, Math.floor(diff / 60000) % 60);
  setUnit(units.secs, Math.floor(diff / 1000) % 60);
}
const timer = setInterval(updateCountdown, 1000);
updateCountdown();

/* ---------- Maps & calendar links ---------- */
$("#maps-link").href =
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(CONFIG.venue);

(function () {
  const start = new Date(CONFIG.date);
  const end = new Date(start.getTime() + 6 * 3600000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: CONFIG.eventTitle,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: CONFIG.venue,
    details: "The Okpalachukwu and Okoloagu Families invite you to witness the Traditional Marriage of their children.",
  });
  $("#cal-link").href = "https://calendar.google.com/calendar/render?" + params;
})();

/* ---------- Gallery ---------- */
const grid = $("#gallery-grid");
CONFIG.photos.forEach((src, i) => {
  const fig = document.createElement("figure");
  fig.dataset.n = i + 1;
  const img = new Image();
  img.loading = "lazy";
  img.decoding = "async";
  img.alt = `Oluebube and Onyedikachi — photo ${i + 1}`;
  img.src = src;
  img.addEventListener("error", () => fig.classList.add("placeholder"));
  fig.appendChild(img);
  grid.appendChild(fig);
});

/* lightbox */
const lb = $("#lightbox");
const lbImg = $("img", lb);
let lbIndex = 0;

function realPhotos() {
  return $$("figure:not(.placeholder) img", grid);
}
function showPhoto(i) {
  const imgs = realPhotos();
  if (!imgs.length) return;
  lbIndex = (i + imgs.length) % imgs.length;
  lbImg.style.opacity = 0;
  setTimeout(() => {
    lbImg.src = imgs[lbIndex].src;
    lbImg.alt = imgs[lbIndex].alt;
    lbImg.style.opacity = 1;
  }, 150);
}
function openLightbox(img) {
  const imgs = realPhotos();
  lbIndex = imgs.indexOf(img);
  lbImg.src = img.src;
  lbImg.alt = img.alt;
  lbImg.style.opacity = 1;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add("show"));
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  lb.classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(() => (lb.hidden = true), 400);
}

grid.addEventListener("click", (e) => {
  const fig = e.target.closest("figure");
  if (fig && !fig.classList.contains("placeholder")) openLightbox($("img", fig));
});
$(".lb-close", lb).addEventListener("click", closeLightbox);
$(".lb-prev", lb).addEventListener("click", (e) => { e.stopPropagation(); showPhoto(lbIndex - 1); });
$(".lb-next", lb).addEventListener("click", (e) => { e.stopPropagation(); showPhoto(lbIndex + 1); });
lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
document.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPhoto(lbIndex - 1);
  if (e.key === "ArrowRight") showPhoto(lbIndex + 1);
});

/* swipe in lightbox */
let touchX = null;
lb.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
lb.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
  touchX = null;
});

/* ---------- Footer contacts ---------- */
const contactsBox = $("#contacts");
Object.entries(CONFIG.contacts).forEach(([side, people], i) => {
  const col = document.createElement("div");
  col.className = "reveal";
  col.style.setProperty("--d", 0.15 + i * 0.1 + "s");
  col.innerHTML = `<h3>${side}</h3><ul>${people
    .map((p) => `<li>${p.name} — <a href="tel:${p.phone.replace(/[^\d+]/g, "")}">${p.phone}</a></li>`)
    .join("")}</ul>`;
  contactsBox.appendChild(col);
});

/* ---------- RSVP → WhatsApp ---------- */
const form = $("#rsvp-form");
const formError = $("#form-error");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";
  $$(".field", form).forEach((f) => f.classList.remove("invalid"));

  const missing = $$("[required]", form).filter((el) => !el.value.trim());
  if (missing.length) {
    missing.forEach((el) => el.closest(".field").classList.add("invalid"));
    formError.textContent = "Please fill in your name, phone number and the two choices.";
    missing[0].focus();
    return;
  }

  const d = Object.fromEntries(new FormData(form));
  const lines = [
    "Hello! Here is my RSVP for Oluebube & Onyedikachi’s Traditional Marriage (5 Dec 2026).",
    "",
    `Name: ${d.name}`,
    `Phone: ${d.phone}`,
    d.email && `Email: ${d.email}`,
    d.city && `Staying in: ${d.city}`,
    `Guest of: ${d.side}`,
    `Attending: ${d.attending}`,
    d.note && `Note: ${d.note}`,
  ].filter((l) => l !== undefined && l !== "");

  const url = `https://wa.me/${CONFIG.rsvpWhatsApp}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");

  form.hidden = true;
  $("#thanks").hidden = false;
});

form.addEventListener("input", (e) => {
  const f = e.target.closest(".field");
  if (f && e.target.value.trim()) f.classList.remove("invalid");
});

/* ---------- Floating flecks ---------- */
if (!reduceMotion) {
  $$(".speckled").forEach((sec) => {
    const n = window.innerWidth < 600 ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const f = document.createElement("span");
      f.className = "fleck";
      f.setAttribute("aria-hidden", "true");
      f.style.left = Math.random() * 100 + "%";
      f.style.top = Math.random() * 100 + "%";
      f.style.setProperty("--s", (2 + Math.random() * 3).toFixed(1) + "px");
      f.style.setProperty("--t", (7 + Math.random() * 8).toFixed(1) + "s");
      f.style.setProperty("--x", (Math.random() * 20 - 10).toFixed(0) + "px");
      f.style.setProperty("--y", (Math.random() * -24 - 6).toFixed(0) + "px");
      f.style.animationDelay = (-Math.random() * 10).toFixed(1) + "s";
      sec.appendChild(f);
    }
  });
}

/* ---------- Hero parallax ----------
   As the page scrolls, the hero's background and text move slower than
   the page (see .hero-bg / .hero-inner), so the next section slides up
   over them while the names fade. */
const hero = $(".hero");
let heroTicking = false;

function updateHero() {
  heroTicking = false;
  const h = hero.offsetHeight;
  const y = Math.min(window.scrollY, h); // nothing to move once it's gone
  hero.style.setProperty("--scroll", y.toFixed(1) + "px");
  hero.style.setProperty("--p", (y / h).toFixed(3));
  hero.classList.toggle("scrolled", y > 10);
  // petals belong to the hero; fade them out as the guest scrolls on to read
  const petalCanvas = $(".petal-canvas");
  if (petalCanvas) petalCanvas.style.opacity = Math.max(0, 1 - (y / h) * 2.5).toFixed(3);
}

if (!reduceMotion) {
  window.addEventListener("scroll", () => {
    if (!heroTicking) {
      heroTicking = true;
      requestAnimationFrame(updateHero);
    }
  }, { passive: true });
}

/* ---------- Dividers ----------
   Inline the symbol so CSS can style and animate each stroke
   (styles don't reach inside <use> copies). */
const dividerMarkup = $("#divider").innerHTML;
$$("svg.divider").forEach((svg) => {
  svg.setAttribute("viewBox", "0 0 240 24");
  svg.innerHTML = dividerMarkup;
});

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0, rootMargin: "0px 0px -4% 0px" }
);
$$(".reveal, .gallery figure").forEach((el) => io.observe(el));
