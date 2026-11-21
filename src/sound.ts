export type Cue =
  | "spawn" | "pick" | "put" | "approve" | "pin" | "rush" | "chaos" | "win" | "lose" | "swap" | "sick" | "nope" | "tick"
  | "squawk" | "rescue" | "escape";

// The background loop: C, A minor, F, G, one bar each, in eighth notes
const chords = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
const bassLine = [131, 110, 87, 98];
const arpeggio = [0, 1, 2, 1, 2, 1, 0, 1];
const melody = [[784, 0, 659, 0, 784, 880, 784, 0], [659, 0, 523, 0, 659, 0, 0, 0], [698, 0, 659, 0, 587, 0, 523, 0], [587, 0, 494, 0, 587, 659, 587, 0]];

const storageKey = "shift-happens-muted";

// Small synthesised sound effects, so the game needs no audio files.
export function createSound() {
  let context: AudioContext | undefined;
  let muted = false;
  try {
    muted = localStorage.getItem(storageKey) === "1";
  } catch {
    // Storage can be unavailable in private or embedded browsers.
  }

  function unlock() {
    if (!context) {
      try {
        context = new AudioContext();
      } catch {
        return;
      }
    }
    if (context.state === "suspended") void context.resume();
  }

  function note(frequency: number, at: number, length: number, type: OscillatorType, volume: number, slideTo?: number, output?: AudioNode) {
    if (!context) return;
    const start = context.currentTime + at;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(output ?? context.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
  }

  // Background music, scheduled a little ahead of time so it stays in rhythm
  let musicBus: GainNode | undefined;
  let tempo = 0;
  let step = 0;
  let nextStep = 0;
  let scheduler: number | undefined;

  function scheduleMusic() {
    if (!context || context.state !== "running" || muted || !tempo) {
      nextStep = 0;
      return;
    }
    if (!musicBus) {
      musicBus = context.createGain();
      musicBus.gain.value = 0.8;
      musicBus.connect(context.destination);
    }
    // Restart cleanly after a pause, such as a hidden tab
    if (nextStep < context.currentTime) nextStep = context.currentTime + 0.05;
    const stepLength = 0.25 / tempo;
    while (nextStep < context.currentTime + 0.15) {
      const bar = Math.floor(step / 8) % chords.length;
      const beat = step % 8;
      const at = nextStep - context.currentTime;
      if (beat % 4 === 0) note(bassLine[bar], at, stepLength * 3.5, "triangle", 0.08, undefined, musicBus);
      note(chords[bar][arpeggio[beat]] * 2, at, stepLength * 0.8, "sine", 0.025, undefined, musicBus);
      const tune = melody[bar][beat];
      if (tune) note(tune, at, stepLength * 1.6, "triangle", 0.03, undefined, musicBus);
      nextStep += stepLength;
      step++;
    }
  }

  function thud(volume: number) {
    if (!context) return;
    const length = 0.16;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * length), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  const cues: Record<Cue, () => void> = {
    spawn: () => note(880, 0, 0.09, "sine", 0.05, 1320),
    pick: () => note(520, 0, 0.1, "triangle", 0.12, 860),
    put: () => note(420, 0, 0.1, "triangle", 0.1, 260),
    approve: () => {
      thud(0.9);
      note(196, 0, 0.18, "square", 0.05, 110);
      note(784, 0.08, 0.16, "sine", 0.08);
    },
    pin: () => {
      note(988, 0, 0.12, "sine", 0.11);
      note(1319, 0.07, 0.2, "sine", 0.1);
    },
    rush: () => {
      note(330, 0, 0.14, "sawtooth", 0.05, 660);
      note(660, 0.13, 0.18, "sawtooth", 0.05, 990);
    },
    chaos: () => [0, 0.12, 0.24].forEach((at, i) => note(440 + i * 220, at, 0.16, "sawtooth", 0.05, 660 + i * 330)),
    // A short, low "uh-uh" when something can't be done
    nope: () => {
      note(260, 0, 0.08, "square", 0.045, 220);
      note(190, 0.1, 0.12, "square", 0.045, 150);
    },
    tick: () => note(1250, 0, 0.04, "square", 0.03),
    // The bin chicken: two scratchy honks
    squawk: () => {
      thud(0.3);
      note(820, 0, 0.13, "sawtooth", 0.06, 460);
      note(900, 0.17, 0.16, "sawtooth", 0.06, 420);
    },
    rescue: () => [660, 880, 1175].forEach((tone, i) => note(tone, i * 0.07, 0.14, "triangle", 0.1)),
    escape: () => {
      note(700, 0, 0.12, "sawtooth", 0.05, 900);
      note(520, 0.14, 0.3, "triangle", 0.08, 260);
    },
    win: () => [523, 659, 784, 1047].forEach((tone, i) => note(tone, i * 0.11, 0.32, "triangle", 0.12)),
    lose: () => [392, 330, 262].forEach((tone, i) => note(tone, i * 0.18, 0.34, "triangle", 0.1)),
    sick: () => [0, .16, .5, .66].forEach(at => note(1180, at, 0.12, "square", 0.04)),
    swap: () => {
      note(620, 0, 0.07, "sine", 0.08, 930);
      note(930, 0.06, 0.08, "sine", 0.06, 1240);
    },
  };

  return {
    unlock,
    play(cue: Cue) {
      if (!muted && context?.state === "running") cues[cue]();
    },
    /** Plays the background loop at this speed (1 is normal), or stops it with 0. Safe to call every frame. */
    setMusic(speed: number) {
      tempo = speed;
      if (speed > 0 && scheduler === undefined) {
        step = 0;
        nextStep = 0;
        scheduler = window.setInterval(scheduleMusic, 25);
      } else if (speed === 0 && scheduler !== undefined) {
        window.clearInterval(scheduler);
        scheduler = undefined;
      }
    },
    get muted() {
      return muted;
    },
    setMuted(value: boolean) {
      muted = value;
      try {
        localStorage.setItem(storageKey, value ? "1" : "0");
      } catch {
        // Ignore storage failures; the setting still applies for this visit.
      }
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
