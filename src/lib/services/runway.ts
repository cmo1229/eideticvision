import axios from "axios"

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY
const RUNWAY_BASE = "https://api.dev.runwayml.com/v1"
const RUNWAY_VERSION = "2024-09-13"

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"

export interface RunwayTask {
  id: string
  status: TaskStatus
  output?: string[]
  progress?: number
  error?: string
  createdAt?: string
}

function headers() {
  return {
    Authorization: `Bearer ${RUNWAY_API_KEY}`,
    "Content-Type": "application/json",
    "X-Runway-Version": RUNWAY_VERSION,
  }
}

export async function createTextToVideo(
  prompt: string,
  duration = 5,
  ratio: "1280:720" | "720:1280" = "1280:720"
): Promise<string> {
  if (!RUNWAY_API_KEY) throw new Error("RUNWAY_API_KEY not configured")

  const { data } = await axios.post(
    `${RUNWAY_BASE}/text_to_video`,
    { model: "gen4.5", promptText: prompt, ratio, duration },
    { headers: headers() }
  )

  return data.id
}

export async function createImageToVideo(
  imageUrl: string,
  prompt: string,
  duration = 5,
  ratio: "1280:720" | "720:1280" = "1280:720"
): Promise<string> {
  if (!RUNWAY_API_KEY) throw new Error("RUNWAY_API_KEY not configured")

  const { data } = await axios.post(
    `${RUNWAY_BASE}/image_to_video`,
    {
      model: "gen4.5",
      promptImage: imageUrl,
      promptText: prompt,
      ratio,
      duration,
    },
    { headers: headers() }
  )

  return data.id
}

export async function getTask(taskId: string): Promise<RunwayTask> {
  if (!RUNWAY_API_KEY) throw new Error("RUNWAY_API_KEY not configured")

  const { data } = await axios.get(`${RUNWAY_BASE}/tasks/${taskId}`, {
    headers: headers(),
  })

  return {
    id: data.id,
    status: data.status,
    output: data.output,
    progress: data.progress,
    error: data.error,
    createdAt: data.createdAt,
  }
}

export async function pollTask(
  taskId: string,
  timeoutMs = 5 * 60 * 1000,
  pollIntervalMs = 3000
): Promise<RunwayTask> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const task = await getTask(taskId)

    if (task.status === "SUCCEEDED" || task.status === "FAILED" || task.status === "CANCELLED") {
      return task
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  throw new Error(`Task ${taskId} timed out after ${timeoutMs / 1000}s`)
}

export async function generateImageToVideo(
  imageUrl: string,
  prompt: string,
  duration = 5
): Promise<string[]> {
  const taskId = await createImageToVideo(imageUrl, prompt, duration)
  const task = await pollTask(taskId)

  if (task.status === "FAILED") {
    throw new Error(task.error ?? "RunwayML generation failed")
  }

  if (!task.output || task.output.length === 0) {
    throw new Error("RunwayML returned no output")
  }

  return task.output
}

export async function generateTextToVideo(
  prompt: string,
  duration = 5
): Promise<string[]> {
  const taskId = await createTextToVideo(prompt, duration)
  const task = await pollTask(taskId)

  if (task.status === "FAILED") {
    throw new Error(task.error ?? "RunwayML generation failed")
  }

  if (!task.output || task.output.length === 0) {
    throw new Error("RunwayML returned no output")
  }

  return task.output
}
