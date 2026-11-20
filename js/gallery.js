const webPhoto = /^assets\/photos\/web\/(?:thumbnails|display)\/[\w-]+\.webp$/;

const chapterConfig = {
  story: { group: "us", empty: "The pages are ready for our photographs." },
  adore: { group: "her", empty: "The pages are ready for your photographs." },
};

let manifestPromise;
let dialogReady = false;

function fetchManifest() {
  // Always re-read the manifest from disk; captions and imports change often.
  manifestPromise ??= fetch("./data/memories.json", { cache: "no-store" }).then(response => {
    if (!response.ok) throw new Error(`Photo list returned HTTP ${response.status}`);
    return response.json();
  });
  return manifestPromise;
}

function setupDialog() {
  const full = document.querySelector("#photo-full");
  const caption = document.querySelector("#photo-caption");
  if (!dialogReady) {
    dialogReady = true;
    document.querySelector("#photo-dialog").addEventListener("close", () => full.removeAttribute("src"));
    full.addEventListener("error", () => {
      caption.hidden = false;
      caption.textContent = "This photograph couldn't be loaded.";
    });
  }
}

export async function loadChapter(chapterId) {
  const config = chapterConfig[chapterId];
  const section = document.getElementById(chapterId);
  const status = section.querySelector("[role=status]");
  const grid = section.querySelector(".polaroids");
  const dialog = document.querySelector("#photo-dialog");
  const full = document.querySelector("#photo-full");
  const caption = document.querySelector("#photo-caption");
  setupDialog();

  try {
    const manifest = await fetchManifest();
    const group = manifest?.[config.group];
    if (!Array.isArray(group)) throw new Error(`The photo list is missing the "${config.group}" group`);
    const photos = group.filter(entry => typeof entry === "object" && entry !== null);
    const dateKey = photo => /^\d{4}-\d{2}-\d{2}$/.test(photo.date ?? "") ? photo.date : "9999";
    photos.sort((first, second) => dateKey(first).localeCompare(dateKey(second)));
    if (photos.some(photo => !webPhoto.test(photo.src) || !webPhoto.test(photo.thumbnail))) {
      throw new Error("A photo does not point to the generated WebP files");
    }

    for (const photo of photos) {
      const figure = document.createElement("figure");
      figure.className = "polaroid";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.setAttribute("aria-haspopup", "dialog");
      const image = new Image();
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = photo.alt || photo.caption || "Open photograph";
      image.src = photo.thumbnail;
      const label = [photo.date, photo.caption].filter(Boolean).join(" \u00b7 ");
      trigger.append(image);
      figure.append(trigger);
      if (label) {
        const note = document.createElement("figcaption");
        note.textContent = label;
        figure.append(note);
      }
      trigger.addEventListener("click", () => {
        full.alt = photo.alt || photo.caption || "Scrapbook photograph";
        caption.textContent = label;
        caption.hidden = !label;
        dialog.showModal();
        full.src = photo.src;
      });
      grid.append(figure);
    }
    if (photos.length) status.hidden = true;
    else status.textContent = config.empty;
  } catch (error) {
    status.textContent = "The photographs couldn't be loaded. Check the photo list and try reloading.";
    console.error(error);
  }
}
