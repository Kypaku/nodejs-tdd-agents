import { AgentCommands } from "./constants"

export function handleContentBeforeWrite(path: string, content: string): string {
    if (path.endsWith(".js")) {
        let res = content
            .replace(/^\s?(\`\`\`)?\s?javascript?/g, '')
            .replace(/^\s?(\`\`\`)?\s?js?/g, '')
            .replace(/(^|\n)\s?(\`\`\`)?\s?plaintext?/g, '')
            .replace(/(^|\n)plaintext(\n|$)/g, '')
            .replace(/\`\`\`/, '')
            .replace(/^([а-яА-ЯёЁ])/ugm, '//$1')
            .replaceAll(AgentCommands.COMPLETE_TASK, '')
            .replaceAll(new RegExp(`\\n${AgentCommands.NEED_FILE_CONTENT}.+?(\\n|$)`, 'g'), '\n')
            .replace(/^\`/, '')
            .replace(/\`$/, '')
        res = res.split('```')[0]
        return res
    }
    return content
}

export function filterTestResult(str: string): string {
    const triggerLine = 'open handles potentially keeping Jest from exiting:'
    const res = str.split(triggerLine)[0]
        .replaceAll('node_modules/supertest/lib', '')
        .replaceAll('node_modules/superagent/', '')
    return res
}
