import { AgentCommands } from "./constants"

export function handleContentBeforeWrite(path: string, content: string): string {
    if (path.endsWith(".js")) {
        const res = content
            .replace(/^\s?(\`\`\`)?\s?javascript?/g, '')
            .replace(/^\s?(\`\`\`)?\s?js?/g, '')
            .replace(/(^|\n)\s?(\`\`\`)?\s?plaintext?/g, '')
            .replace(/(^|\n)plaintext(\n|$)/g, '')
            .replace(/\`\`\`/g, '')
            .replace(/^([а-яА-ЯёЁ])/ugm, '//$1')
            .replaceAll(AgentCommands.COMPLETE_TASK, '')
            .replace(/^\`/, '')
            .replace(/\`$/, '')
        return res
    }
    return content
}

export function filterTestResult(str: string): string {
    const triggerLine = 'open handles potentially keeping Jest from exiting:' 
    return str.split(triggerLine)[0]
}
