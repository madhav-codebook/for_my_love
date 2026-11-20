const waltz = [
  [[45, 52, 60], [76, 72, 71]], [[41, 53, 60], [69, null, 72]],
  [[48, 55, 64], [74, 76, 79]], [[43, 55, 62], [77, null, 74]],
  [[45, 52, 60], [76, 72, 71]], [[41, 53, 60], [69, 72, 77]],
  [[38, 53, 57], [76, 74, 72]], [[40, 56, 59], [71, null, null]],
  [[45, 52, 60], [72, 76, 81]], [[41, 53, 60], [79, 77, 76]],
  [[48, 55, 64], [76, 74, 72]], [[43, 55, 62], [74, null, 79]],
  [[38, 53, 57], [77, 76, 74]], [[41, 53, 60], [72, 69, 72]],
  [[40, 56, 59], [71, 74, 68]], [[45, 52, 60], [69, null, null]],
];

async function renderWaltz() {
  const beat = 0.67;
  const sampleRate = 22050;
  const loopFrames = Math.round(waltz.length * 3 * beat * sampleRate);
  const audio = new OfflineAudioContext(1, loopFrames + sampleRate * 2, sampleRate);
  const dry = audio.createGain();
  dry.connect(audio.destination);
  for (const [seconds, level] of [[.105, .13], [.197, .08], [.281, .04]]) {
    const delay = audio.createDelay();
    const gain = audio.createGain();
    delay.delayTime.value = seconds;
    gain.gain.value = level;
    dry.connect(delay).connect(gain).connect(audio.destination);
  }

  function strike(note, time, level) {
    for (const [partial, amplitude, decay] of [[1, 1, 1.35], [2, .28, .75], [3, .11, .38], [4, .05, .2]]) {
      const tone = audio.createOscillator();
      const envelope = audio.createGain();
      tone.frequency.value = 440 * 2 ** ((note - 69) / 12) * partial;
      envelope.gain.setValueAtTime(.0001, time);
      envelope.gain.exponentialRampToValueAtTime(level * amplitude, time + .009);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + decay);
      tone.connect(envelope).connect(dry);
      tone.start(time);
      tone.stop(time + decay);
    }
  }

  for (const [bar, [chord, melody]] of waltz.entries()) {
    const start = bar * 3 * beat;
    strike(chord[0], start, .09);
    for (const pulse of [1, 2]) {
      strike(chord[1], start + pulse * beat, .044);
      strike(chord[2], start + pulse * beat + .018, .038);
    }
    melody.forEach((note, pulse) => {
      if (note !== null) strike(note, start + pulse * beat + .026, .18 - pulse * .021);
    });
  }

  const result = await audio.startRendering();
  const samples = result.getChannelData(0);
  const loop = audio.createBuffer(1, loopFrames, sampleRate);
  loop.copyToChannel(samples.subarray(0, loopFrames), 0);
  // Fold the final note's decay into the start of the loop.
  const output = loop.getChannelData(0);
  for (let frame = loopFrames; frame < samples.length; frame++) output[frame - loopFrames] += samples[frame];
  return loop;
}

export function setupMusic() {
  const button = document.querySelector(".music");
  const label = document.querySelector("#music-label");
  const status = document.querySelector("#music-status");
  let audio;
  let source;
  let volume;
  let playing = false;

  async function setPlaying(next) {
    button.disabled = true;
    status.textContent = "";
    try {
      if (!audio) audio = new AudioContext();
      await audio.resume(); // Must follow a user gesture (here or inside the game frame).
      if (!source) {
        const buffer = await renderWaltz();
        volume = audio.createGain();
        volume.gain.value = 0;
        volume.connect(audio.destination);
        source = audio.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(volume);
        source.start();
      }
      playing = next;
      volume.gain.setTargetAtTime(playing ? .42 : 0, audio.currentTime, .035);
      button.setAttribute("aria-pressed", String(playing));
      label.textContent = playing ? "Mute music" : "Play music";
    } catch (error) {
      status.textContent = "Music could not start in this browser.";
      label.textContent = "Retry music";
      console.error(error);
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", () => {
    // Ignore the click when a start is already in flight (e.g. the
    // first-gesture listener fired for this same click).
    if (!button.disabled) setPlaying(!playing);
  });
  return {
    async ensurePlaying() {
      if (!playing && !button.disabled) await setPlaying(true);
    },
  };
}
