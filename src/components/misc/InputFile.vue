<template>
    <div class="flex-center">
        <InputText
            class="w-full"
            :label="'Directory: '"
            :value="value"
            @update:value="val => $emit('update:value', val)"/>
        <button @click="selectFolder" class="btn-select mt-6 -ml-6" >
            <IconFolder/>
        </button>
    </div>
</template>

<script lang='ts'>
    import { defineComponent } from 'vue'
    import InputText from './InputText.vue'
    import IconFolder from './icons/IconFolder.vue'
    import { remote } from 'electron'

    export default defineComponent({
        components: {
            InputText,
            IconFolder,
        },
        props: {
            value: {
                type: String,
                default: '',
            },
            isDir: {
                type: Boolean,
                default: false
            }
        },
        data() {
            return {

            }
        },
        computed: {

        },
        methods: {

            async selectFolder() {
                try {
                    const properties = this.isDir ? ['openDirectory'] : ['openFile'] as any
                    const result = await remote.dialog.showOpenDialog({ properties })
                    if (!result.canceled && result.filePaths.length > 0) {
                        this.$emit('update:value', result.filePaths[0])
                    }
                } catch (err) {
                    console.log(err)
                }
            },
        },
    })

    </script>

<style lang="scss" scoped>

</style>
