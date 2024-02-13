import {
    createModel,
    startGoalPrompt,
    executeTaskPrompt,
    createTasksPrompt,
} from "../utils/prompts"
import type { ModelSettings } from "../utils/types"
import { LLMChain } from "langchain/chains"
import { extractTasks } from "../utils/helpers"
import { IAdditionalInformation, IAgentSettings, ITask } from "@/types"
import SimpleGPT from "gpt-simple-api-ts"

export async function startGoalAgent(settings: IAgentSettings, goal: string, additionalInformation?: IAdditionalInformation): Promise<ITask[]> {
    (window as any).numRequests++
    const prompt = startGoalPrompt(goal, settings.language || 'en', additionalInformation) 
    const res = await ((window as any).api as SimpleGPT).getFirst(prompt, settings)
    return extractTasks(res, []).map((stringOne) => {
        return {
            content: stringOne,
            created: new Date().toISOString(),
        }
    })
}

export function renderFromUser(fromUser: any[]): string {
    if (!fromUser) return ""
    return `Additional information from the user:\n` + fromUser.filter((fromUserOne) => fromUserOne.answer || typeof fromUserOne === "string")
        .map((fromUserOne) => {
            if (typeof fromUserOne === "string") {
                return fromUserOne
            } else {
                return 'The Question: ' + fromUserOne.ask + ":\nThe Answer: " + fromUserOne.answer
            }
        }).join("\n")
}

export function renderFiles(files: any[]): string {
    if (!files) return ""
    return `Files:\n` + files.map((fileOne) => {
        return 'The Path: ' + fileOne.path + ":\nThe Content: " + fileOne.content
    }).join("\n")
}

export function renderUrls(urls: any[]): string {
    if (!urls) return ""
    return `Web resources:\n` + urls.map((urlOne) => {
        return 'The Url: ' + urlOne.url + ":\nThe Content: " + urlOne.content
    }).join("\n")
}

export async function executeTaskAgent(
    modelSettings: ModelSettings,
    goal: string,
    task: ITask,
    settings: IAgentSettings,
    additionalInformation?: IAdditionalInformation
): Promise< {result, prompt}> {
    (window as any).numRequests++
    const prompt = executeTaskPrompt(goal, task.content, settings.language || 'en', {
        fromUser: renderFromUser(additionalInformation?.fromUser),
        fileSystem: [...(additionalInformation?.fileSystem || []), settings.dirs?.join(", ")].filter(Boolean).join(', ') || "Unknown",
        files: renderFiles(additionalInformation?.files),
        urls: renderUrls(additionalInformation?.urls),
        testsResult: additionalInformation?.testsResult || "Unknown",
        prevAnswers: additionalInformation?.prevAnswers?.join("\n") || "Unknown",
    }) 
    const result = await ((window as any).api as SimpleGPT).getFirst(prompt, settings)

    return {result, prompt}
}

export async function createTasksAgent(
    modelSettings: ModelSettings,
    goal: string,
    tasks: ITask[],
    lastTask: ITask,
    result: string,
    completedTasks: string[] | undefined
): Promise<ITask[]> {
    (window as any).numRequests++
    const completion = await new LLMChain({
        llm: createModel(modelSettings),
        prompt: createTasksPrompt,
    }).call({
        goal,
        tasks: tasks.map((task) => task.content),
        lastTask: lastTask.content,
        result,
        customLanguage: modelSettings.customLanguage,
    })

    return extractTasks(completion.text as string, completedTasks || []).map((stringOne) => {
        return {
            content: stringOne,
            created: new Date().toISOString(),
        }
    })
}
