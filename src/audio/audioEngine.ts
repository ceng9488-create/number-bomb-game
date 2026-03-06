import * as Tone from "tone";

// ============================================
// AUDIO ENGINE FOR NUMBER BOMB
// Uses Tone.js to generate chiptune-style
// background music and sound effects
// ============================================

let isAudioStarted = false;
let bgLoop: Tone.Loop | null = null;
let bgSynth: Tone.PolySynth | null = null;
let bassSynth: Tone.MonoSynth | null = null;
let sfxSynth: Tone.Synth | null = null;
let noiseSynth: Tone.NoiseSynth | null = null;
let isMusicPlaying = false;

// Melody notes for the background loop (fun, tense, game-like)
const melodyNotes = [
  "C4", "E4", "G4", "A4",
  "G4", "E4", "C4", "D4",
  "E4", "G4", "A4", "B4",
  "A4", "G4", "E4", "D4",
];

const bassNotes = [
  "C2", "C2", "G2", "G2",
  "A2", "A2", "E2", "E2",
  "F2", "F2", "C2", "C2",
  "G2", "G2", "D2", "D2",
];

// Danger mode melody (more tense)
const dangerMelody = [
  "C5", "B4", "C5", "B4",
  "A4", "G#4", "A4", "G#4",
  "G4", "F#4", "G4", "F#4",
  "F4", "E4", "F4", "E4",
];

const dangerBass = [
  "C2", "C2", "C2", "C2",
  "A1", "A1", "A1", "A1",
  "G1", "G1", "G1", "G1",
  "F1", "F1", "F1", "F1",
];

let stepIndex = 0;
let isDangerMode = false;

export async function ensureAudioStarted(): Promise<void> {
  if (!isAudioStarted) {
    await Tone.start();
    isAudioStarted = true;
  }
}

function createSynths() {
  if (bgSynth) return; // already created

  bgSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "square" },
    envelope: {
      attack: 0.01,
      decay: 0.15,
      sustain: 0.2,
      release: 0.3,
    },
    volume: -18,
  }).toDestination();

  bassSynth = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.4,
      release: 0.2,
    },
    volume: -20,
  }).toDestination();

  sfxSynth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.05,
      release: 0.2,
    },
    volume: -12,
  }).toDestination();

  noiseSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.005,
      decay: 0.4,
      sustain: 0,
    },
    volume: -10,
  }).toDestination();
}

export function startBackgroundMusic(): void {
  if (isMusicPlaying) return;
  createSynths();

  stepIndex = 0;
  Tone.getTransport().bpm.value = 140;

  bgLoop = new Tone.Loop((time) => {
    const melody = isDangerMode ? dangerMelody : melodyNotes;
    const bass = isDangerMode ? dangerBass : bassNotes;
    const idx = stepIndex % melody.length;

    bgSynth?.triggerAttackRelease(melody[idx], "16n", time);

    // Bass hits every 2 steps
    if (idx % 2 === 0) {
      bassSynth?.triggerAttackRelease(bass[idx], "8n", time);
    }

    stepIndex++;
  }, "8n");

  bgLoop.start(0);
  Tone.getTransport().start();
  isMusicPlaying = true;
}

export function stopBackgroundMusic(): void {
  if (!isMusicPlaying) return;

  bgLoop?.stop();
  bgLoop?.dispose();
  bgLoop = null;
  Tone.getTransport().stop();
  isMusicPlaying = false;
}

export function setDangerMode(danger: boolean): void {
  if (isDangerMode !== danger) {
    isDangerMode = danger;
    if (isMusicPlaying) {
      Tone.getTransport().bpm.value = danger ? 180 : 140;
    }
  }
}

// ===== SOUND EFFECTS =====

export function playGuessSound(): void {
  createSynths();
  const now = Tone.now();
  sfxSynth?.triggerAttackRelease("E5", "32n", now);
  sfxSynth?.triggerAttackRelease("G5", "32n", now + 0.06);
}

export function playSafeSound(): void {
  createSynths();
  const now = Tone.now();
  sfxSynth?.triggerAttackRelease("C5", "16n", now);
  sfxSynth?.triggerAttackRelease("E5", "16n", now + 0.08);
  sfxSynth?.triggerAttackRelease("G5", "16n", now + 0.16);
}

export function playExplosionSound(): void {
  createSynths();
  const now = Tone.now();

  // Low rumble
  noiseSynth?.triggerAttackRelease("4n", now);

  // Descending tones for dramatic effect
  sfxSynth?.triggerAttackRelease("C5", "16n", now);
  sfxSynth?.triggerAttackRelease("G3", "8n", now + 0.1);
  sfxSynth?.triggerAttackRelease("C2", "4n", now + 0.25);
}

export function playStartSound(): void {
  createSynths();
  const now = Tone.now();
  sfxSynth?.triggerAttackRelease("C4", "16n", now);
  sfxSynth?.triggerAttackRelease("E4", "16n", now + 0.08);
  sfxSynth?.triggerAttackRelease("G4", "16n", now + 0.16);
  sfxSynth?.triggerAttackRelease("C5", "8n", now + 0.24);
}

export function getIsMusicPlaying(): boolean {
  return isMusicPlaying;
}
