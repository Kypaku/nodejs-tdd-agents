import { AgentCommands } from "./constants"

export function handleContentBeforeWrite(path: string, content: string): string {
    if (path.endsWith(".js")) {
        return content
            .replace(/^\s?(\`\`\`)?\s?javascript?/g, '')
            .replace(/^\s?(\`\`\`)?\s?plaintext?/g, '')
            .replace(/(^|\n)plaintext(\n|$)/g, '')
            .replace(/\`\`\`/g, '')
            .replace(/^([а-яА-ЯёЁ])/ugm, '//$1')
            .replaceAll(AgentCommands.COMPLETE_TASK, '')
    }
    return content
}
