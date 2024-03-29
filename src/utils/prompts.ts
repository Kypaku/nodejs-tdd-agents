import { OpenAI } from "langchain/llms/openai"
import { PromptTemplate } from "langchain/prompts"
import type { ModelSettings } from "./types"
import { AgentCommands, GPT_35_TURBO } from "./constants"
import { IAdditionalInformation, IAgentSettings } from "@/types"

export const createModel = (settings: ModelSettings) => {
    let _settings: ModelSettings | undefined = settings
    if (!settings.customModelName) {
        _settings = undefined
    }

    const options = {
        openAIApiKey: _settings?.customApiKey || process.env.OPENAI_API_KEY,
        temperature: _settings?.customTemperature || 0.9,
        modelName: _settings?.customModelName || GPT_35_TURBO,
        maxTokens: _settings?.maxTokens || 400,
    }

    const baseOptions = {
        basePath: process.env.OPENAI_API_BASE_URL,
    }
    console.log(
        "Dogtiti ~ file: prompts.ts:22 ~ createModel ~ options:",
        options,
        baseOptions
    )

    return new OpenAI(options, baseOptions)
}

const qq = "`"

export const startGoalPrompt = (goal: string, customLanguage: string, additionalInformation?: IAdditionalInformation): string => {
    return `You are an autonomous task creation AI called AgentGPT that created to work with Node.js projects
You have the following objective QQQ${goal}QQQ
Check the test results to estimate your progress.
You cannot change the tests files.
Create a list of zero to three tasks to be completed by your AI system such that your goal is more closely reached or completely reached
Return the response as an array of strings in JSON format. 
Use QQQ${customLanguage}QQQ
${additionalInformation ? `Additional information:
FROM_USER:
QQQ${additionalInformation.fromUser}QQQ
FILE_SYSTEM:
QQQ${additionalInformation.fileSystem}QQQ
FILES:
QQQ${additionalInformation.files}QQQ
URLS:
QQQ${additionalInformation.urls}QQQ
TESTS_RESULT:
QQQ${additionalInformation.testsResult}QQQ
YOUR PREVIOUS ANSWERS:
QQQ${additionalInformation.prevAnswers}QQQ` : ''}`.replaceAll("QQQ", qq)
}

export const executeTaskPrompt = (goal: string,
    task: string,
    customLanguage: string,
    additionalInformation?: {[key: string]: string},
    settings?: IAgentSettings): string => (
    `You are an autonomous task execution AI called AgentGPT
You have the following objective QQQ${goal}QQQ
You have the following task QQQ${task}QQQ
Check the test results to estimate your progress.
You cannot change the tests files.
Execute the task and return the response as a string
if you need additional information then return ${AgentCommands.INPUT}: $description (e.g. ${AgentCommands.INPUT}: I need more information about the task)
${settings.sendFsEveryLoop ? '' : `if you need to know the structure of the directories you have access then return ${AgentCommands.NEED_FILE_SYSTEM}`}
if you need to know the content of a specific file then return ${AgentCommands.NEED_FILE_CONTENT}: $absolutePath (e.g. ${AgentCommands.NEED_FILE_CONTENT}: C:/path/to/index.js) - this command can be used only once in your answer
if you need to write content to  a specific file then return ${AgentCommands.WRITE_FILE_CONTENT}: $absolutePath (e.g. ${AgentCommands.WRITE_FILE_CONTENT}: C:/path/to/index.js \n$RAW_CONTENT) so $RAW_CONTENT is literal content to write, no need to add quotes, name of file or programming language
if you need to know the content of any url then return ${AgentCommands.NEED_URL_CONTENT}: $url (e.g. ${AgentCommands.NEED_URL_CONTENT}: https://www.google.com)
if you think that the task is completed then return ${AgentCommands.COMPLETE_TASK}
Use QQQ${customLanguage}QQQ
Additional information:
FROM_USER:
QQQ${additionalInformation.fromUser}QQQ
FILE_SYSTEM:
QQQ${additionalInformation.fileSystem}QQQ
FILES:
QQQ${additionalInformation.files}QQQ
URLS:
QQQ${additionalInformation.urls}QQQ
TESTS_RESULT:
QQQ${additionalInformation.testsResult}QQQ
YOUR PREVIOUS ANSWERS:
QQQ${additionalInformation.prevAnswers}QQQ
`.replaceAll("QQQ", qq)
)

export const createTasksPrompt = new PromptTemplate({
    template:
`You are an AI task creation agent
You have the following objective QQQ{goal}QQQ
You have the following incomplete tasks QQQ{tasks}QQQ and have just executed the following task QQQ{lastTask}QQQ and received the following result QQQ{result}QQQ
Based on this, create a new task to be completed by your AI system ONLY IF NEEDED such that your goal is more closely reached or completely reached
Return the response as an array of strings that can be used in JSON.parse() and NOTHING ELSE
Use QQQ{customLanguage}QQQ.`.replaceAll("QQQ", qq),
    inputVariables: ["goal", "tasks", "lastTask", "result", "customLanguage"],
})

export const fixPrompt = (prevAnswer: string): string => {
    return `Your previous answer has at least one commands (${Object.values(AgentCommands)}), but it seems that you did not use it correctly. 
Please try again if it necessary. 
Your previous answer was:\n\n${prevAnswer}\n\n`
}
