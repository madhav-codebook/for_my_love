export function setupEnvelope() {
  const post = document.querySelector("#post");
  const art = document.querySelector("#envelope-art");
  const button = post.querySelector(".open-letter");
  const card = document.querySelector("#invitation");
  const status = document.querySelector("#envelope-status");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function getParts() {
    const svg = art.contentDocument;
    const flap = svg?.getElementById("flap");
    const seal = svg?.getElementById("seal");
    return flap && seal ? { flap, seal } : null;
  }

  // The object has its own document and may still be loading at the first click.
  async function waitForParts() {
    const parts = getParts();
    if (parts) return parts;
    return new Promise(resolve => {
      function finish() {
        clearTimeout(timeout);
        art.removeEventListener("load", finish);
        art.removeEventListener("error", finish);
        resolve(getParts());
      }
      const timeout = setTimeout(finish, 1800);
      art.addEventListener("load", finish);
      art.addEventListener("error", finish);
    });
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    const parts = await waitForParts();
    if (parts) {
      const { flap, seal } = parts;
      if (!reducedMotion.matches) {
        try {
          seal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
          await flap.animate(
            [{ transform: "scaleY(1)" }, { transform: "scaleY(-.74)" }],
            { duration: 460, easing: "ease-in-out", fill: "forwards" }
          ).finished;
        } catch (error) {
          console.warn("Envelope animation did not finish:", error);
        }
      }
      flap.style.transform = "scaleY(-.74)";
      seal.style.opacity = "0";
    } else {
      status.textContent = "The envelope artwork couldn't load, but the letter is still here.";
      status.hidden = false;
    }

    card.hidden = false;
    card.inert = true;
    // Measure the initial position before transitioning the HTML card.
    card.getBoundingClientRect();
    post.classList.add("is-open");
    const slide = card.getAnimations()[0];
    if (slide) await slide.finished.catch(error => console.warn("Letter animation interrupted:", error));
    card.inert = false;
    button.setAttribute("aria-expanded", "true");
    if (!post.closest("section").hidden && (document.activeElement === document.body || document.activeElement === button)) {
      card.querySelector("h2").focus({ preventScroll: true });
    }
  });
}
