import { AgentCommands } from "@/utils/constants"
import { existFile } from "./node_gm"

export function recognizeCommand(res: string, cmd: AgentCommands): boolean {
    if (cmd === AgentCommands.WRITE_FILE_CONTENT) {
        // check if in the text have a next template:
        // WRITE_FILE_CONTENT: path/to/file.txt
        // content

        if (res.includes(AgentCommands.WRITE_FILE_CONTENT + ": ")) {
            // check if the rest of the line is a valid path
            const restOfTheLine = res.split(AgentCommands.WRITE_FILE_CONTENT)[1]?.trim()
                .split('\n')[0]?.trim()
                .replace(": ", "")
            if (restOfTheLine) {
                return true
            }
        }
    }
    if (cmd === AgentCommands.NEED_FILE_CONTENT) {
        // check if in the text have a next template:
        // NEED_FILE_CONTENT: path/to/file.txt
        if (res.includes(AgentCommands.NEED_FILE_CONTENT)) {
            const restOfTheLine = res.split(AgentCommands.NEED_FILE_CONTENT)[1]?.trim()
                .split('\n')[0]?.trim()
                .replace(": ", "")
            if (existFile(restOfTheLine)) {
                return true
            }
        }
    }
    if (cmd === AgentCommands.COMPLETE_TASK) {
        const re = new RegExp(`(^|\\n)\s*${AgentCommands.COMPLETE_TASK}\s*($|\\n)`, 'g')
        return !!res.match(re)
    }
}

export interface IFileContent {
    path: string
    content: string
}


export function getContentFromRes(res: string): IFileContent[] {
    const commandPattern = /WRITE_FILE_CONTENT:(.*?)\n([\s\S]*?)(?=\nWRITE_FILE_CONTENT:|$)/g
    let match
    const contents = [] as IFileContent[]

    while ((match = commandPattern.exec(res)) !== null) {
        // Extracting path and content from each match
        const path = match[1].trim()
        const content = match[2].trim()
        contents.push({ path, content })
    }

    return contents
}

export function getPathFromRes(res: string): string {
    return res.split(AgentCommands.NEED_FILE_CONTENT)[1].trim().split('\n')[0].trim().replace(": ", "")
}
