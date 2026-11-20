import type { FxKind } from "./round";

/** One sound per rules fx kind, plus "swap" for switching critters. */
export type Cue = FxKind | "swap";

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

  function note(frequency: number, at: number, length: number, type: OscillatorType, volume: number, slideTo?: number) {
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
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
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

  const stamp = () => {
    thud(0.9);
    note(196, 0, 0.18, "square", 0.05, 110);
    note(784, 0.08, 0.16, "sine", 0.08);
  };
  const alarm = () => [0, .16, .5, .66].forEach(at => note(1180, at, 0.12, "square", 0.04));
  const fanfare = (rise: number) => {
    note(330 * rise, 0, 0.14, "sawtooth", 0.05, 660 * rise);
    note(660 * rise, 0.13, 0.18, "sawtooth", 0.05, 990 * rise);
  };

  const cues: Record<Cue, () => void> = {
    spawn: () => note(880, 0, 0.09, "sine", 0.05, 1320),
    open: () => {
      note(700, 0, 0.09, "sine", 0.06, 1050);
      note(1050, 0.08, 0.1, "sine", 0.05);
    },
    pick: () => note(520, 0, 0.1, "triangle", 0.12, 860),
    put: () => note(420, 0, 0.1, "triangle", 0.1, 260),
    stamp,
    accept: () => {
      note(660, 0, 0.1, "sine", 0.09);
      note(990, 0.08, 0.16, "sine", 0.09);
    },
    pin: () => {
      note(988, 0, 0.12, "sine", 0.11);
      note(1319, 0.07, 0.2, "sine", 0.1);
    },
    nope: () => {
      note(220, 0, 0.09, "square", 0.06, 180);
      note(180, 0.1, 0.14, "square", 0.06, 140);
    },
    cancel: alarm,
    shred: () => {
      thud(0.6);
      note(140, 0, 0.3, "sawtooth", 0.04, 90);
    },
    snatch: () => [0, .09, .18].forEach(at => note(1400, at, 0.07, "square", 0.05, 900)),
    knock: () => {
      thud(1);
      note(300, 0, 0.12, "triangle", 0.1, 120);
    },
    rescue: () => [660, 880, 1100].forEach((tone, i) => note(tone, i * 0.07, 0.14, "triangle", 0.09)),
    escape: () => note(500, 0, 0.4, "sawtooth", 0.05, 120),
    dash: () => note(300, 0, 0.12, "sine", 0.06, 700),
    busy: () => fanfare(1),
    chaos: () => fanfare(1.5),
    win: () => [523, 659, 784, 1047].forEach((tone, i) => note(tone, i * 0.11, 0.32, "triangle", 0.12)),
    lose: () => [392, 330, 262].forEach((tone, i) => note(tone, i * 0.18, 0.34, "triangle", 0.1)),
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
