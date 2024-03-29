import axios from "axios"
import type { ModelSettings, GuestSettings } from "../utils/types"
import { createTasksAgent, executeTaskAgent, startGoalAgent } from "../services/AgentService"
import {
    AgentCommands,
    DEFAULT_MAX_LOOPS_CUSTOM_API_KEY,
    DEFAULT_MAX_LOOPS_FREE,
    DEFAULT_MAX_LOOPS_PAID,
} from "../utils/constants"
import type { Message } from "../types/agentTypes"
import { v4 } from "uuid"
import type { RequestBody } from "../utils/interfaces"
import { updateAgent } from "@/api/json"
import { IAgent, IMessage, ITask } from "@/types"
import { getFilesInDirectory } from "@/helpers"
import { createDirectoryR, existFile, isParentDirectoryR, parentDirectories, parentDirectory, readFile, runAsync, runSync, sleep, writeFile } from "@/helpers/node_gm"
import { filterTestResult, handleContentBeforeWrite } from "@/utils/contentHandlers"
import { fixPrompt } from "@/utils/prompts"
import * as path from 'path'
import { getContentFromRes, getPathFromRes, recognizeCommand } from "@/helpers/recognizeCommand"

const TIMEOUT_LONG = 1000
const TIMOUT_SHORT = 800
class AutonomousAgent {
    name: string;
    goal: string;
    tasks: ITask[] = [];
    completedTasks: string[] = [];
    modelSettings: ModelSettings;
    isRunning = false;
    renderMessage: (message: Message) => IMessage;
    shutdown: () => void;
    numLoops = 0;
    _id: string;
    id: string
    guestSettings: GuestSettings;
    messages: IMessage[] = []
    agent: IAgent
    constructor(
        name: string,
        goal: string,
        renderMessage: (message: Message) => IMessage,
        shutdown: () => void,
        modelSettings: ModelSettings,
        guestSettings: GuestSettings,
        agent: IAgent
    ) {
        this.name = name
        this.goal = goal
        this.renderMessage = renderMessage
        this.shutdown = shutdown
        this.modelSettings = modelSettings
        this._id = v4()
        this.guestSettings = guestSettings
        this.agent = agent
        this.tasks = agent.tasks?.map((task) => task.content ? task : { content: task } as any) || []
    }

    get uncompletedTasks() {
        return this.tasks.filter((task) => !task.completed)
    }

    async run(agent: IAgent) {
        this.id = agent.id
        this.isRunning = true
        this.tasks = agent.tasks?.map((task) => task.content ? task : { content: task } as any) || []

        // Initialize by getting tasks
        try {
            if (!this.uncompletedTasks?.length) {
                await this.getInitialTasks()
            }
            for (const task of this.uncompletedTasks) {
                await sleep(TIMOUT_SHORT)
                this.sendTaskMessage(task.content)
            }
        } catch (e) {
            console.log(e)
            this.sendErrorMessage(getMessageFromError(e))
            this.shutdown()
            return
        }

        await this.loop()
    }

    saveTasks() {
        updateAgent({ id: this.id, tasks: this.tasks })
    }

    async loop() {
        console.log(`Loop ${this.numLoops}`)
        console.log(this.tasks)

        if (!this.isRunning) {
            return
        }

        if (this.tasks.length === 0) {
            this.sendCompletedMessage()
            this.shutdown()
            return
        }

        this.numLoops += 1
        const maxLoops = this.maxLoops()
        if (this.numLoops > maxLoops) {
            this.sendLoopMessage()
            this.shutdown()
            return
        }

        // Wait before starting
        await new Promise((r) => setTimeout(r, TIMEOUT_LONG))

        if (!this.uncompletedTasks.length) {
            await this.getInitialTasks()
        }

        if (this.agent.settings.sequentialMode) {
            const currentTask = this.uncompletedTasks[0]
            const currentTaskIndex = this.tasks.findIndex((task) => task.id === currentTask.id)
            this.sendThinkingMessage(currentTaskIndex + ': ' + currentTask.content)

            const { result, prompt } = await this.executeTask(currentTask as ITask)

            this.saveTasks()
            this.sendExecutionMessage(currentTask, result, prompt)

            await this.runTests(currentTask)
        } else {
            // Execute first task
            // Get and remove first task
            this.completedTasks.push(this.tasks[0]?.content || "")
            const currentTask = this.tasks.shift()

            this.sendThinkingMessage(currentTask.content)

            this.tasks.push(currentTask as ITask)

            const { result, prompt } = await this.executeTask(currentTask as ITask)
            this.saveTasks()
            this.sendExecutionMessage(currentTask, result)

            // Wait before adding tasks
            await new Promise((r) => setTimeout(r, TIMEOUT_LONG))
            this.sendThinkingMessage('Add new tasks')

            // Add new tasks
            if (this.tasks.filter((task) => !task.completed).length < 4) {
                try {
                    const newTasks = await this.getAdditionalTasks(
                currentTask as ITask,
                result
                    )
                    this.tasks = newTasks.concat(this.tasks)
                    this.saveTasks()
                    for (const task of newTasks) {
                        await new Promise((r) => setTimeout(r, TIMOUT_SHORT))
                        this.sendTaskMessage(task.content)
                    }

                    if (newTasks.length == 0) {
                        this.sendActionMessage("task-marked-as-complete", "Task marked as complete: " + currentTask)
                    }
                } catch (e) {
                    console.log(e)
                    this.sendErrorMessage(`errors.adding-additional-task`)
                    this.sendActionMessage("task-marked-as-complete", "Task marked as complete: " + currentTask)
                }
            }
        }

        await this.loop()
    }

    completeTask(currentTask: ITask, result: string) {
        if (currentTask) {
            this.sendMessage({ type: "system", value: `Task completed: ${currentTask.content}`, taskId: currentTask.id })
            currentTask.result = result
            currentTask.completed = new Date().toISOString()
            const nextTask = this.uncompletedTasks[0]
            if (nextTask) {
                nextTask.additionalInformation = nextTask.additionalInformation || {}
                nextTask.additionalInformation.files = currentTask.additionalInformation.files
            }
            this.saveTasks()
        }
    }

    private maxLoops() {
        const defaultLoops = DEFAULT_MAX_LOOPS_FREE

        return this.modelSettings.customApiKey
            ? this.modelSettings.customMaxLoops || DEFAULT_MAX_LOOPS_CUSTOM_API_KEY
            : defaultLoops
    }

    async getInitialTasks(): Promise<void> {
        this.sendMessage({ type: "system", value: "Getting tasks..." })
        const { result, raw, prompt } = await startGoalAgent(this.agent.settings || {}, this.goal, this.tasks.at(-1)?.additionalInformation)
        result.forEach((re) => {
            re.id = v4()
            re.additionalInformation = re.additionalInformation || {}
            re.additionalInformation.fileSystem = this.getFileSystem()
        })
        this.sendMessage({ type: "hidden", value: raw, prompt })
        this.tasks.push(...(result as ITask[]))
        this.saveTasks()
    }

    async getAdditionalTasks(
        currentTask: ITask,
        result: string
    ): Promise<ITask[]> {
        const res = await createTasksAgent(
            this.modelSettings,
            this.goal,
            this.tasks,
            currentTask,
            result,
            this.completedTasks
        )
        res.forEach((re) => {
            re.id = v4()
            re.additionalInformation = re.additionalInformation || {}
            re.additionalInformation.fileSystem = this.getFileSystem()
        })
        return res as ITask[]
    }

    async handleTaskResult(task: ITask, taskResult: string) {
        !task.additionalInformation && (task.additionalInformation = {})
        if ((this.agent.settings.sendFsEveryLoop || taskResult.includes(AgentCommands.NEED_FILE_SYSTEM)) && this.agent.settings.allowRead) {
            task.additionalInformation.fileSystem = this.getFileSystem()
        }
        if (recognizeCommand(taskResult, AgentCommands.NEED_FILE_CONTENT) && this.agent.settings.allowRead) {
            const path = getPathFromRes(taskResult)
            path && this.addFileToTask(path, task)
        } else if (recognizeCommand(taskResult, AgentCommands.WRITE_FILE_CONTENT) && this.agent.settings.allowWrite) {
            const reses = getContentFromRes(taskResult)
            reses.forEach(({path, content}) => {
                path && this.writeFile(path, content, task)
            })
        } else if (!taskResult.indexOf(AgentCommands.NEED_URL_CONTENT)) {
            console.log("NEED_URL_CONTENT", taskResult)
            const url = taskResult.split(':').slice(1).join(':').trim()
            url && await this.addUrlToTask(url, task)
        } else if (!taskResult.indexOf(AgentCommands.INPUT + ':')) {
            !task.additionalInformation.fromUser && (task.additionalInformation.fromUser = [])
            task.additionalInformation.fromUser.push({ ask: taskResult.split(AgentCommands.INPUT + ':')[1] })
        } else if (recognizeCommand(taskResult, AgentCommands.COMPLETE_TASK)) {
            this.completeTask(task as ITask, taskResult)
        } else if (Object.values(AgentCommands).some(el => taskResult.includes(el))) {
            !task.additionalInformation.fromUser && (task.additionalInformation.fromUser = [])
            task.additionalInformation.fromUser.push(fixPrompt(taskResult) as any)
        } else {
            // clear fromUser but only strings
            if (task.additionalInformation.fromUser) {
                task.additionalInformation.fromUser = task.additionalInformation.fromUser.filter((el) => typeof el === "string")
            }
            // save task
            // this.completeTask(task as ITask, taskResult)
        }
    }

    async runTests(task: ITask) {
        let testsResult = ''
        try {
            if (this.agent.settings.tests) {
                for await (const test of this.agent.settings.tests) {
                    const testCmd = `cd ${this.agent.dir} && ${test}`
                    const result = await runAsync(testCmd)
                    testsResult += filterTestResult(result) + '\n'
                }
            }
        } catch (e) {
            console.error('runTests:' + e)
        }
        console.log("runTests", { testsResult })
        this.sendMessage({ type: "tests", value: testsResult, taskId: task.id })
        task.additionalInformation.testsResult = testsResult
        const testsValue = testsResult.match(/Tests:.*?\n/)?.[0]
        let total = +testsValue?.match(/(\d+) total/)?.[1] || 0
        let passed = +testsValue?.match(/(\d+) passed/)?.[1] || 0
        const testsSuitesValue = testsResult.match(/Test Suites:.*?\n/)?.[0]
        total += +(testsSuitesValue?.match(/(\d+) total/)?.[1] || 0)
        passed += +(testsSuitesValue?.match(/(\d+) passed/)?.[1] || 0)
        if (total === passed) {
            this.sendMessage({ type: "system", value: "All tests passed!" })
            this.stopAgent(true)
        }
    }

    addFileToTask(_path: string, task: ITask) {
        const content = this.getFileContent(_path.trim())

        this.agent.settings.dirs = this.agent.settings.dirs || []
        const dirs = [this.agent.dir, ...this.agent.settings.dirs]

        if (path.basename(_path) === _path || _path.startsWith('/')) {
            _path = path.normalize(`${this.agent.dir}/${_path}`)
        }

        const isParents = dirs.map((dir) => isParentDirectoryR(dir, _path))
        if (isParents.some(Boolean)) {
            !task.additionalInformation.files && (task.additionalInformation.files = [])
            const existingFile = task.additionalInformation.files?.find((file) => file.path === _path)
            if (existingFile) {
                existingFile.content = content
                return
            } else {
                task.additionalInformation.files.push({ path: _path, content })
            }
        } else {
            this.sendErrorMessage(`errors.file-not-in-allowed-dirs: ` + _path)
        }
    }

    writeFile(_path: string, content: string, task: ITask) {
        // check if the agent is allowed to write files
        if (!this.agent.settings.allowWrite) {
            this.sendErrorMessage(`errors.agent-not-allowed-to-write`)
            return
        }
        this.agent.settings.dirs = this.agent.settings.dirs || []
        const dirs = [this.agent.dir, ...this.agent.settings.dirs]

        if (path.basename(_path) === _path || _path.startsWith('/')) {
            _path = path.normalize(`${this.agent.dir}/${_path}`)
        }

        const isParents = dirs.map((dir) => isParentDirectoryR(dir, _path))
        if (!isParents.some(Boolean)) {
            this.sendErrorMessage(`errors.file-not-in-allowed-dirs: ` + _path)
            return
        }
        if (path.basename(_path) === 'package.json' || path.dirname(_path).match(/(\/|\\)tests/)) {
            this.sendErrorMessage(`errors.forbidden-to-write: ` + _path)
            return
        }
        const parentDir = parentDirectory(_path)
        if (!existFile(parentDir)) {
            createDirectoryR(parentDir)
        }
        const handledContent = handleContentBeforeWrite(_path, content)
        writeFile(_path, handledContent)
        this.addFileToTask(_path, task)
        setTimeout(() => {
            this.sendMessage({ type: "system", value: `File written: ${_path}`, taskId: task.id })
        }, 0)
    }

    getFileContent(path: string): string {
        const content = readFile(path)
        return content
    }

    getFileSystem(): string[] {
        const dirs = [this.agent.dir, ...(this.agent.settings.dirs || [])]
        const fileSystem = dirs.map((dir) => getFilesInDirectory(dir, dir).map((dirOne) => dirOne.fullPath)).flat()
        return fileSystem
    }

    async addUrlToTask(url: string, task: ITask) {
        const content = await this.getUrlContent(url)
        //             const content = await this.getUrlContent(url)
        //  content && (task.additionalInformation.urls = [{ url, content }])
        // Check file is already in task and if so, don't just update it
        const existingUrl = task.additionalInformation.urls?.find((_url) => _url.url === url)
        if (existingUrl) {
            existingUrl.content = content
            return
        } else {
            !task.additionalInformation.urls && (task.additionalInformation.urls = [])
            task.additionalInformation.urls.push({ url, content })
        }
    }

    async getUrlContent(url: string): Promise<string> {
        const res = await axios.get(url)
        return res.data
    }

    async executeTask(task: ITask): Promise<{result, prompt}> {
        const { result, prompt } = await executeTaskAgent(
            this.modelSettings,
            this.goal,
            task,
            this.agent.settings,
            task.additionalInformation
        )
        this.handleTaskResult(task, result)
        task.additionalInformation.prevAnswers = [result]
        return { result, prompt }
    }

    stopAgent(byTest = false) {
        if (byTest) {
            this.sendActionMessage("manually-shutdown", "Agent successfully achieved the goal!")
        } else {
            this.sendManualShutdownMessage()
        }
        this.isRunning = false
        this.shutdown()
        return
    }

    sendMessage(message: Message) {
        if (this.isRunning) {
            const msg = this.renderMessage(message)
            this.messages.push(msg)
        }
    }

    sendGoalMessage() {
        this.sendMessage({ type: "goal", value: this.goal })
    }

    sendLoopMessage() {
        this.sendMessage({
            type: "system",
            value:
        this.modelSettings.customApiKey !== ""
            ? "errors.loop-with-filled-customApiKey"
            : "errors.loop-with-empty-customApiKey",
        })
    }

    sendManualShutdownMessage() {
        this.sendMessage({
            type: "system",
            value: "manually-shutdown",
        })
    }

    sendCompletedMessage() {
        this.sendMessage({
            type: "system",
            value: "All tasks completed! ",
        })
    }

    sendThinkingMessage(msg: string) {
        this.sendMessage({ type: "thinking", value: "Thinking... " + msg })
    }

    sendTaskMessage(task: string) {
        this.sendMessage({ type: "task", value: task })
    }

    sendErrorMessage(error: string) {
        this.sendMessage({ type: "system", value: error })
    }

    sendExecutionMessage(task: ITask, execution: string, prompt?: string) {
        this.sendMessage({
            type: "action",
            info: `Executing "${task.content}"`,
            value: execution,
            prompt,
        })
    }

    sendActionMessage(message: string, value?: string) {
        this.sendMessage({
            type: "action",
            info: message,
            value: "",
        })
    }
}

const testConnection = async (modelSettings: ModelSettings) => {
    // A dummy connection to see if the key is valid
    // Can't use LangChain / OpenAI libraries to test because they have retries in place
    return await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: modelSettings.customModelName,
            messages: [{ role: "user", content: "Say this is a test" }],
            max_tokens: 7,
            temperature: 0,
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${modelSettings.customApiKey ?? ""}`,
            },
        }
    )
}

const getMessageFromError = (e: unknown) => {
    let message = "errors.accessing-apis"
    if (axios.isAxiosError(e)) {
        const axiosError = e
        if (axiosError.response?.status === 429) {
            message = "errors.accessing-using-apis"
        }
        if (axiosError.response?.status === 404) {
            message = "errors.accessing-gtp4"
        }
    } else {
        message = "errors.initial-tasks"
    }
    return message
}

export default AutonomousAgent
