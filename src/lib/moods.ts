export type MoodId = "lucid" | "noir" | "warm" | "cinematic" | "ethereal"

export interface Mood {
  id: MoodId
  label: string
  icon: string
  color: string
  prompt: string
  bloom: { threshold: number; intensity: number; smoothing: number }
  vignette: { darkness: number; offset: number }
  hue: number
  saturation: number
}

export const MOODS: Mood[] = [
  {
    id: "lucid",
    label: "Lucid",
    icon: "✦",
    color: "#a78bfa",
    prompt:
      "dreamlike, soft focus, shallow depth of field, ethereal glow, floating particles, slow camera drift, hazy atmosphere, pastel color palette, 8mm film aesthetic, gentle light leaks",
    bloom: { threshold: 0.4, intensity: 1.8, smoothing: 0.95 },
    vignette: { darkness: 0.5, offset: 0.15 },
    hue: 0.08,
    saturation: 0.1,
  },
  {
    id: "noir",
    label: "Noir",
    icon: "◧",
    color: "#94a3b8",
    prompt:
      "film noir, dramatic shadows, high contrast black and white, venetian blind shadows, 1940s cinema, rain-slicked streets, hard lighting, mystery atmosphere, silver gelatin print texture, deep blacks, crushed shadows",
    bloom: { threshold: 0.8, intensity: 0.2, smoothing: 0.7 },
    vignette: { darkness: 0.85, offset: 0.1 },
    hue: 0,
    saturation: -1,
  },
  {
    id: "warm",
    label: "Warm",
    icon: "☀",
    color: "#f59e0b",
    prompt:
      "golden hour, warm sunlight, nostalgic haze, super 8 film, vintage color grading, sun flare, soft film grain, 1970s Kodachrome, gentle camera sway, analog warmth, light leaks, amber tones",
    bloom: { threshold: 0.6, intensity: 0.6, smoothing: 0.85 },
    vignette: { darkness: 0.3, offset: 0.12 },
    hue: 0.04,
    saturation: 0.15,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    icon: "⬡",
    color: "#38bdf8",
    prompt:
      "cinematic widescreen, anamorphic lens, teal and orange color grade, sweeping slow camera movement, epic scale, atmospheric haze, 24fps film look, blue hour, volumetric lighting, IMAX quality, shallow depth of field",
    bloom: { threshold: 0.5, intensity: 0.7, smoothing: 0.9 },
    vignette: { darkness: 0.4, offset: 0.1 },
    hue: 0.02,
    saturation: 0.25,
  },
  {
    id: "ethereal",
    label: "Ethereal",
    icon: "◌",
    color: "#e879f9",
    prompt:
      "otherworldly, misty, celestial, soft pastels, heavenly shafts of light, floating dust motes, slow motion, gauzy atmosphere, dreamlike, iridescent highlights, prismatic light rays, weightless",
    bloom: { threshold: 0.3, intensity: 2.2, smoothing: 0.98 },
    vignette: { darkness: 0.35, offset: 0.2 },
    hue: 0.12,
    saturation: 0.08,
  },
]

export function getMood(id: string): Mood {
  return MOODS.find((m) => m.id === id) ?? MOODS[0]
}
