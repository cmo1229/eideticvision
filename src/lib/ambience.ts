"use client"

/* ------------------------------------------------------------------ */
/*  Procedural ambience — filtered noise shaped per mood                */
/*  No audio assets: wind/room tone generated with WebAudio             */
/* ------------------------------------------------------------------ */

import type { MoodId } from "@/lib/moods"

interface MoodVoice {
  filterFreq: number
  lfoRate: number
  lfoDepth: number
  gain: number
  rumble: boolean
}

const VOICES: Record<MoodId, MoodVoice> = {
  lucid:   { filterFreq: 420, lfoRate: 0.07, lfoDepth: 220, gain: 0.05, rumble: false },
  noir:    { filterFreq: 180, lfoRate: 0.04, lfoDepth: 80,  gain: 0.06, rumble: true },
  warm:    { filterFreq: 700, lfoRate: 0.09, lfoDepth: 300, gain: 0.045, rumble: false },
  cinematic: { filterFreq: 320, lfoRate: 0.05, lfoDepth: 180, gain: 0.055, rumble: true },
  ethereal: { filterFreq: 900, lfoRate: 0.11, lfoDepth: 420, gain: 0.04, rumble: false },
}

let ctx: AudioContext | null = null
let nodes: {
  src: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  lfo: OscillatorNode
  rumbleOsc?: OscillatorNode
  rumbleGain?: GainNode
} | null = null

function makeNoiseBuffer(audio: AudioContext): AudioBuffer {
  // 8 seconds of brown-ish noise, looped
  const len = audio.sampleRate * 8
  const buffer = audio.createBuffer(1, len, audio.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

export async function startAmbience(mood: MoodId) {
  try {
    if (!ctx) {
      ctx = new AudioContext()
    }
    if (ctx.state === "suspended") {
      await ctx.resume()
    }
    stopAmbience()

    const voice = VOICES[mood] ?? VOICES.lucid
    const src = ctx.createBufferSource()
    src.buffer = makeNoiseBuffer(ctx)
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = voice.filterFreq
    filter.Q.value = 0.6

    const gain = ctx.createGain()
    gain.gain.value = 0
    // fade in
    gain.gain.linearRampToValueAtTime(voice.gain, ctx.currentTime + 3)

    // Slow gust LFO on the filter
    const lfo = ctx.createOscillator()
    lfo.frequency.value = voice.lfoRate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = voice.lfoDepth
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    let rumbleOsc: OscillatorNode | undefined
    let rumbleGain: GainNode | undefined
    if (voice.rumble) {
      rumbleOsc = ctx.createOscillator()
      rumbleOsc.type = "sine"
      rumbleOsc.frequency.value = 48
      rumbleGain = ctx.createGain()
      rumbleGain.gain.value = 0.018
      rumbleOsc.connect(rumbleGain)
      rumbleGain.connect(ctx.destination)
      rumbleOsc.start()
    }

    src.start()
    lfo.start()
    nodes = { src, filter, gain, lfo, rumbleOsc, rumbleGain }
  } catch {
    // Audio unavailable — stay silent
  }
}

export function stopAmbience() {
  if (!nodes || !ctx) return
  try {
    nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
    const n = nodes
    setTimeout(() => {
      try {
        n.src.stop()
        n.lfo.stop()
        n.rumbleOsc?.stop()
      } catch {}
    }, 1100)
  } catch {}
  nodes = null
}
