<template>
    <div class="input-api-key">
        <InputText
            class="mb-2"
            v-model:value="apiKey"
            :error="!apiKey"
            label="API Key"
            @update:value="updateKey"  />
    </div>
</template>

<script lang='ts'>
    import { defineComponent, PropType } from 'vue'
    import ls from 'local-storage'
    import InputText from './InputText.vue'
    import SimpleGPT from 'gpt-simple-api-ts'

    export default defineComponent({
        props: {

        },
        components: {
            InputText
        },
        data() {
            return {
                apiKey: ls("apiKey") as unknown as string || '',
                ls
            }
        },
        computed: {

        },
        methods: {
            updateKey(val: string) {
                ls('apiKey', val);
                (window as any).api = new SimpleGPT({ key: val })
            },

        },
    })

    </script>

<style lang="scss" scoped>

</style>
