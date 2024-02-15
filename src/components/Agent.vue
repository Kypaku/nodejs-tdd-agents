<template>
    <div class="agent" v-if="agent">
        <div class="name">
            <div class="flex-center">
                <InputText
                    class="w-full"
                    :label="'Name: '"
                    :value="agent?.name"
                    @update:value="val => updateAgent('name', val)"/>
                <button @click="deleteAgent" class="rounded hover:bg-gray-600 bg-gray-700 text-white p-1 mt-6" >
                    <TrashIcon />
                </button>
            </div>
        </div>
        <div class="goal mt-2">
            <InputTextarea
                class="w-full"
                :label="'Goal: '"
                :value="agent?.goal"
                @update:value="val => updateAgent('goal', val)"/>
        </div>
        <div class="dir flex-center">
            <InputFile
                class="w-full"
                :label="'Directory: '"
                :value="agent?.dir"
                @update:value="val => updateAgent('dir', val)"
                :isDir="true"/>
        </div>
        <div class="panel flex-center-between w-full mt-2">
            <div class="flex-center">
                <button @click="showSettings = !showSettings" class="mr-2 text-white hover:bg-gray-600 bg-gray-700 p-1 rounded" >
                    <IconSettings class="w-5 h-5 " />
                </button>
                <button class="py-1 px-4 bg-yellow-600 rounded" @click="agent.state !== 'running' ? run() : stop()" >{{ agent.state !== 'running' ? 'Run' : 'Stop' }}</button>
            </div>
            <div class="flex-center" >
                <button class="py-1 px-4 bg-blue-900 rounded mr-2 ml-2" @click="clearMessages">Clear</button>
            </div>
        </div>
        <Settings
            v-if="showSettings"
            :value="agent.settings || {}"
            @update:value="val => updateAgent('settings', val)"
            :agent="agent"
            class="mt-2" />
        <div class="tasks mt-4" v-if="tasks.length">
            <div class="flex-center-between">
                <b class="text-lg">Tasks:</b>
                <div class="underline cursor-pointer text-gray-50" @click="clearTasks">
                    Clear tasks
                </div>
            </div>
            <Task
                :class="{'opacity-50': task.completed}"
                @deleteTask="deleteTask(i)"
                :task="task"
                @editTask="editTask(i)"
                @completeTask="completeTask(i)"
                @editAdditionalInfo="data => editAdditionalInfo(i, data)"
                :index="i + 1"
                v-for="(task, i) in tasks"
                :key="i"/>
        </div>
        <div class="log-header mt-6">
            <span class="text-xl">
                <b>Log: </b>
                <span class="text-xs">
                    All: {{ messages?.length }}
                    &nbsp;|&nbsp;
                    Queries: {{ answers?.length }}
                    &nbsp;|&nbsp;
                    Cost: ~{{ cost.toFixed(2) }} $
                    &nbsp;
                </span>
            </span>
            <input
                type="search"
                class="bg-gray-700 text-white p-1 rounded w-1/2"
                placeholder="Search..."
                v-model="q"/>
        </div>
        <div class="log">
            <Message
                :message="item"
                :messages="messages"
                v-for="(item, i) in filteredMessages"
                :agent="agent"
                :index="filteredMessages.length - i"
                :key="item.time"/>
        </div>
    </div>
</template>

<script lang='ts'>
    import { clearAgentMessages, addMessage, delAgent, getMessages, updateAgent } from './../api/json'
    import AutonomousAgent from '@/models/AutonomousAgent'
    import { IAgent, IMessage, ITask } from '@/types'
    import { defineComponent, PropType } from 'vue'
    import ls from 'local-storage'
    import InputText from './misc/InputText.vue'
    import InputTextarea from './misc/InputTextarea.vue'
    import Message from './Message.vue'
    import Task from './Task.vue'
    import TrashIcon from './misc/icons/TrashIcon.vue'
    import IconSettings from './misc/icons/IconSettings.vue'
    import Settings from './partials/Settings.vue'
    import { localeIncludes, total } from '@/helpers/node_gm'
    import InputFile from './misc/InputFile.vue'

    export default defineComponent({
        props: {

        },
        components: {
            TrashIcon,
            Task,
            Message,
            InputText,
            InputTextarea,
            IconSettings,
            Settings,
            InputFile
        },
        // emits: ['update:modelValue'], this.$emit('update:modelValue', title)
        data() {
            return {
                q: '',
                showSettings: false,
                agentInstance: null as AutonomousAgent | null,
                messages: [] as IMessage[],
                settings: (ls as any)('settings') || {},
            }
        },
        computed: {
            cost(): number {
                const promptsCost = total(this.answers.filter((answer) => answer.prompt).map(a => (a.prompt?.length / 4000) * this.settings.costPer1KInput))
                const resultCost = total(this.answers.map(a => (a.value.length / 4000) * this.settings.costPer1KOutput))
                // console.log("cost", this.answers.map(a => (a.value.length)))
                return promptsCost + resultCost
            },

            answers(): IMessage[] {
                return this.messages.filter(m => (m.type === 'action' || m.type === 'hidden') && m.value)
            },

            filteredMessages(): IMessage[] {
                return [...this.messages]
                    .reverse()
                    .filter((item: IMessage) => {
                        if (item.type === 'hidden') return
                        if (!this.q) return true
                        return localeIncludes(item.value || '', this.q)
                    })
            },

            agent(): IAgent | undefined {
                return this.$root.agents?.find(a => a.id === this.$route.params.id) ?? null
            },
            tasks(): ITask[] {
                return this.agentInstance?.tasks || []
            }
        },
        methods: {
            editAdditionalInfo(i: number, data: any) {
                this.agentInstance.tasks[i].additionalInformation = data
                this.updateAgent('tasks', this.agentInstance.tasks)
            },

            clearTasks() {
                if (confirm("Are you sure you want to clear all tasks?")) {
                    this.agentInstance.tasks = []
                    this.updateAgent('tasks', this.agentInstance.tasks)
                }
            },

            completeTask(i: number) {
                const taskContent = prompt("Complete the task:")
                if (taskContent !== null && taskContent.trim() !== "") {
                    this.agentInstance.tasks[i].result = taskContent
                    this.agentInstance.tasks[i].completed = new Date().toISOString()
                    this.updateAgent('tasks', this.agentInstance.tasks)
                }
            },

            editTask(i: number) {
                const taskContent = prompt("Edit task content:", this.agentInstance.tasks[i].content)
                if (taskContent !== null && taskContent.trim() !== "") {
                    this.agentInstance.tasks[i].content = taskContent
                    this.updateAgent('tasks', this.agentInstance.tasks)
                }
            },

            deleteTask(index: number) {
                this.agentInstance.tasks = this.agentInstance.tasks.filter((task, i) => i !== index)
                this.updateAgent('tasks', this.agentInstance.tasks)
            },

            clearMessages() {
                if (confirm("Are you sure you want to clear all messages?")) {
                    this.messages = []
                    // Clear messages from storage as well
                    clearAgentMessages(this.$route.params.id)
                }
            },

            deleteAgent() {
                if (confirm("Are you sure you want to delete the agent?")) {
                    delAgent(this.$route.params.id)
                    this.$root.agents = this.$root.agents.filter(a => a.id !== this.$route.params.id)
                    this.$router.push('/')
                }
            },

            updateAgent(field: string, val: any, noSave?: boolean) {
                this.$root.agents.forEach((a) => {
                    if (a.id === this.$route.params.id) {
                        a[field] = val
                        !noSave && updateAgent({ id: this.$route.params.id, [field]: val })
                    }
                    return a
                })
            },

            stop() {
                this.agentInstance.stopAgent()
                this.updateAgent('state', 'stopped', true)
            },

            async run() {
                this.agentInstance.run(this.agent)
                this.updateAgent('state', 'running', true)
                console.log("run", { "this.agentInstance": this.agentInstance })
            },

        },
        created() {
            if (this.agent) {
                this.settings = this.agent.settings || this.settings
                const settings = {
                    customApiKey: ls("apiKey"),
                    customModelName: this.settings.model || 'gpt-3.5-turbo-0301',
                    customTemperature: +this.settings.temperature || 0.9,
                    customMaxLoops: this.settings.maxLoops || 9999999,
                    maxTokens: +this.settings.maxTokens || 400,
                    customLanguage: this.settings.language || 'en',
                }
                this.agentInstance = new AutonomousAgent(
                    this.agent.name.trim(),
                    this.agent.goal.trim(),
                    (message: any) => {
                        const msg = { time: +new Date(), ...(message || {}) }
                        addMessage(this.agent.id, { ...(message || {}) })
                        console.log(message)
                        this.messages.push(msg)
                        return msg
                    },
                    console.log,
                    settings as any,
                    settings as any,
                    this.agent,
                )
                this.updateAgent('agentInstance', this.agentInstance, true)
                this.messages = getMessages(this.$route.params.id) || []
            }
        },
    })

    </script>

<style lang="scss" scoped>
    .agent{
        max-width: 800px;
    }

    .log{
        max-height: 500px;
        overflow-y: scroll;
    }

</style>
