import AutonomousAgent from "@/models/AutonomousAgent"

export interface IAgentSettings {
    maxLoops?: number
    model?: string
    temperature?: number
    dirs?: string[]
    tests?: string[]
    allowWrite?: boolean
    allowRead?: boolean
    sequentialMode?: boolean
    language?: string
}

export interface IAdditionalInformation {
    fromUser?: {
        ask: string
        answer?: string
    }[]
    files?: {
        path: string
        content: string
    }[],
    urls?: {
        url: string
        content: string
    }[]
    fileSystem?: string[]
    testsResult?: string
    prevAnswers?: string[]
} 
export interface ITask {
    content?: string
    created?: string
    completed?: string
    deleted?: string
    result?: string
    additionalInformation?: IAdditionalInformation
}
export interface IAgent {
    id: string
    name: string
    description?: string
    goal: string
    dir?: string
    state: 'pending' | 'running' | 'stopped' | 'error'
    tasks?: ITask[]
    instance?: AutonomousAgent
    settings?: IAgentSettings
}

export interface IMessage {
    id?: string
    message: string
    value?: string
    type?: 'system' | 'action' | 'thinking' | 'goal' | 'task' | 'tests'
    time: number
}