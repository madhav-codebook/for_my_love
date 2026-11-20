import { setupEnvelope } from "./envelope.js";
import { setupMusic } from "./music.js";
import { loadChapter } from "./gallery.js";

const chapters = [...document.querySelectorAll("main > .chapter")];
const navLinks = document.querySelectorAll("nav a");
const gameFrame = document.querySelector("#game-frame");
const loadedChapters = new Set();

function showChapter(focusHeading = false) {
  const chapter = chapters.find(section => `#${section.id}` === location.hash) ?? chapters[0];
  for (const section of chapters) section.hidden = section !== chapter;
  for (const link of navLinks) {
    if (link.hash === `#${chapter.id}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  if (["story", "adore"].includes(chapter.id) && !loadedChapters.has(chapter.id)) {
    loadedChapters.add(chapter.id);
    loadChapter(chapter.id);
  }
  // Load the game only when its chapter is first opened.
  if (chapter.id === "game" && !gameFrame.getAttribute("src")) {
    gameFrame.src = gameFrame.dataset.src;
  }
  if (focusHeading) {
    window.scrollTo(0, 0);
    chapter.querySelector("h1, h2").focus({ preventScroll: true });
  }
}

setupEnvelope();
const music = setupMusic();

// Browsers only allow sound after an interaction, so the waltz starts
// with her first click or key press anywhere on the page.
const startMusicOnFirstGesture = () => music.ensurePlaying();
window.addEventListener("click", startMusicOnFirstGesture, { capture: true, once: true });
window.addEventListener("keydown", startMusicOnFirstGesture, { capture: true, once: true });

// The game and surprise pages run inside the chapter iframe and report back here.
window.addEventListener("message", event => {
  if (event.origin !== location.origin || event.source !== gameFrame.contentWindow) return;
  if (event.data === "playMusic") music.ensurePlaying();
  if (event.data === "surpriseComplete") location.hash = "#story";
});

window.addEventListener("hashchange", () => showChapter(true));
showChapter();
