import axios from "axios"

const HF_API_KEY = process.env.HF_API_TOKEN
const HF_BASE = "https://api-inference.huggingface.co"

// Polls the HuggingFace Inference API for 3D Gaussian Splatting processing.
// Uses a free Space that runs splatfacto / 3DGS training.
// Hugging Face free tier: 30 min GPU time per month on zero-gpu spaces,
// unlimited CPU with queue wait times.
export async function processWithHuggingFace(fileUrl: string): Promise<string> {
  if (!HF_API_KEY) throw new Error("HF_API_TOKEN not configured — get one at https://huggingface.co/settings/tokens")

  // Start the generation job
  const { data: requestRes } = await axios.post(
    `${HF_BASE}/models/ashawley/imagine3d`,
    {
      input: {
        image_url: fileUrl,
        steps: 50,
        seed: Math.floor(Math.random() * 999999),
      },
    },
    {
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  )

  // If the model returns immediately
  if (requestRes.output) {
    return requestRes.output as string
  }

  // Otherwise poll for the result
  const estimated = requestRes.estimated_time ?? 120

  const startTime = Date.now()
  const pollInterval = setInterval(async () => {
    const { data: statusRes } = await axios.post(
      `${HF_BASE}/models/ashawley/imagine3d`,
      {
        input: {
          image_url: fileUrl,
          steps: 50,
          seed: Math.floor(Math.random() * 999999),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (statusRes.output) {
      clearInterval(pollInterval)
      return statusRes.output as string
    }
  }, Math.max(10000, estimated * 1000 * 0.2))

  // Timeout after 30 min
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      clearInterval(pollInterval)
      reject(new Error("HuggingFace processing timed out"))
    }, 30 * 60 * 1000)
  )
}