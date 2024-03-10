<template>
    <div class="message text-sm mt-2" >
        <div class="flex-center-between">
            <span>{{ index }}: </span>
            <div>
                <button @click="$emit('delete')" class="bg-gray-300 px-1 text-black mr-1" >Del</button> 
                <button @click="$emit('deleteUp')" class="bg-gray-300 px-1 text-black" >Del all above</button> 
            </div>
        </div>
        <div>
            <span class="text-xs text-gray-400"  v-if="message.time">{{ new Date(message.time).toLocaleString() }}</span>
        </div>
        <span v-if="message?.type === 'task'" class="mr-2 text-xs text-gray-300 rounded bg-gray-700 px-1">Add task</span>
        <template v-if="message?.type !== 'tests'">
            <template v-for="(segment, i) in segments">
                <div :key="i" class="code-block mb-1" v-if="segment.isCode">
                    <pre class="overflow-auto max-h-80"><code>{{ segment.text.trim()}}</code></pre>
                </div>
                <span :key="i + 'text'" :class="{'text-yellow-100': isFileWrittenMessage(message)}" v-else>{{ segment.text }}</span>
            </template>
            <div>
                <button @click="test(message)" class="bg-gray-700 opacity-50" >Test</button>
            </div>
        </template>
        <div class="tests" v-else>
            <Accordeon>
                <template #title>
                    <b class="text-xl" >
                        Tests <br/> <span class="text-sm test-value" >{{ testsValue.replace(/ +/g, ' ').replace(/\n /g, '\n') }}</span>
                    </b>
                </template>
                <span class="pre-wrap" >
                    <pre class="overflow-auto max-h-80"><code>{{ message?.value?.trim()}}</code></pre>
                </span>
            </Accordeon>
        </div>
    </div>
</template>

<script lang='ts'>
    import { IAgent, IMessage } from '@/types'
    import { defineComponent, PropType } from 'vue'
    import Accordeon from './misc/Accordeon.vue'
    import AutonomousAgent from '@/models/AutonomousAgent'

    export default defineComponent({
        props: {
            messages: {
                type: Array as PropType<IMessage[]>,
                default: () => []
            },
            index: {
                type: Number,
                default: () => 0
            },
            agent: {
                type: Object as PropType<IAgent>,
                default: () => null
            },
            message: Object as PropType<IMessage>,

        },
        components: {
            Accordeon,

        },
        // emits: ['update:modelValue'], this.$emit('update:modelValue', title)
        data() {
            return {

            }
        },
        computed: {
            testsValue(): string {
                // get line like Tests:       4 failed, 1 passed, 5 total
                const tests = this.message?.value?.match(/Tests:.*?\n/) || []
                const testSuites = this.message?.value?.match(/Test Suites:.*?\n/) || []
                return (tests[0] || '') + ' ' + (testSuites[0] || '') || ''
            },

            segments(): {isCode?: boolean, text: string}[] {
                const divider = "`" + "`" + "`"
                return (this.message.message || this.message.value)?.split(divider)?.map((dividerOne, i) => ({ isCode: !!(i % 2), text: dividerOne.trim() })) || []
            },
        },
        methods: {
            isFileWrittenMessage(message: IMessage): boolean {
                return message?.value?.includes('File written:')
            },
            test(message) {
                const task = this.agent.agentInstance.uncompletedTasks[0] || this.agent.agentInstance.tasks[0]
                console.log('test', this.agent?.agentInstance, this.messages, { message });
                (this.agent?.agentInstance as AutonomousAgent)?.handleTaskResult(task, message.value)
            },

        },
    })

    </script>

<style lang="scss" scoped>
    .test-value{
        font-weight: normal;
    }

    .tests{
        max-width: 600px;
    }

    .code-block{
        max-width: 600px;
    }

    .message{
        span {
            white-space: pre-wrap;
        }
    }

</style>
