import { z } from "zod"

export const messageParser = z.object({
    type: z.enum(["goal", "thinking", "task", "action", "system", "tests", "hidden"]),
    info: z.string().optional(),
    value: z.string(),
    prompt: z.string().optional(),
})

export type Message = z.infer<typeof messageParser>;
