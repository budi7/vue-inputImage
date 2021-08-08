<template>
  <div
    v-cloak
    class="box-input"
    @drop.prevent="handleDroppedFile"
    @dragover.prevent
  >
    <div v-show="!is_full" class="input-placeholder">
      <input
        id="inputFile"
        type="file"
        class="box-file"
        :accept="allowedFileType"
        multiple
        hidden
        @input="handleInput"
      >
      <label :class="`placeholder ${contentClass}`" for="inputFile">
        <div class="group">
          <img class="placeholder-logo" :src="placeholderLogo">
        </div>
      </label>
    </div>
    <div v-for="(dt,i ) in input" :key="`uploaded-${i}`" :class="`preview-wrapper ${contentClass}`">
      <img :src="dt" class="img uploaded">
      <div @click="processRemove(dt)">
        Hapus
      </div>
    </div>
    <div v-for="(dt,i ) in queuedFiles" :key="`queued-${i}`" :class="`preview-wrapper ${contentClass}`">
      <img :src="dt.preview" class="img uploading">
      <div v-if="dt.is_uploading">
        Loading {{ dt.progress }}
      </div>
      <div v-if="dt.is_error">
        {{ dt.error }}
        retry
      </div>
    </div>
  </div>
</template>

<script>
import s3Mixin from './mixin.js'
// import smartReize from './modules/smartResize.js'

export default {
  mixins: [
    s3Mixin
  ],
  props: {
    value: {
      default: () => { return [] },
      type: Array
    },
    multiUploadProcessor: {
      default: 1,
      type: Number
    },
    maxFile: {
      default: null,
      type: Number
    },
    description: {
      default: '',
      type: String
    },
    allowedFileType: {
      default: 'image/jpg, image/jpeg',
      type: String
    },
    storedDimension: {
      default: () => {
        return {
          height: null,
          width: null
        }
      },
      type: Object
    },
    contentClass: {
      default: '',
      type: String
    }
  },
  data () {
    return {
      lang: this.$store.getters['app/getLanguage'],

      input: [],
      queuedFiles: [],
      trash: [],
      is_full: false,
      is_processing: false,

      label: require('./assets/label.json'),
      placeholderLogo: require('./assets/placeholder.svg')
    }
  },
  watch: {
    value (val) {
      this.input = val
    }
  },
  created () {
    this.$on('s3Uploaded', (res) => {
      // move uploaded file to model
      const finishedProcessIdx = this.queuedFiles.findIndex(function (_p) {
        return (_p.id === res.id)
      })
      this.input.push(res.uploaded_url)
      this.queuedFiles.splice(finishedProcessIdx, 1)
      this.$emit('input', this.input)

      // on s3 upload done, run next queue
      this.processQueue()
    })
    this.$on('s3Error', (error) => {
      // on s3 upload error, run next queue
      console.log('error', error)
      this.processQueue()
    })
  },
  mounted () {

  },
  destroyed () {
    this.$off('s3Uploaded')
    this.$off('s3Error')
  },
  methods: {
    handleDroppedFile (evt) {
      if (this.is_full === true) { return }
      evt.dataTransfer.files.forEach((dt) => {
        const extension = dt.type.replace(/(.*)\//g, '')
        this.queuedFiles.push(this.s3MakeFileObject(dt, extension))
      })

      this.checkIsFull()
      this.processQueue()
    },
    handleInput (evt) {
      if (this.is_full === true) { return }

      console.log('tes')
      console.log(this.maxFile, this.input.length, this.queuedFiles.length)

      console.log(evt.target.files)
      evt.target.files.forEach((dt) => {
        const extension = dt.type.replace(/(.*)\//g, '')
        this.queuedFiles.push(this.s3MakeFileObject(dt, extension))
      })

      this.checkIsFull()
      this.processQueue()
    },
    processQueue () {
      if (this.queuedFiles.length === 0) {
        this.$emit('done', this.queuedFiles)
        return
      }
      if (!this.is_processing) {
        this.$emit('procesing', this.queuedFiles)
      }

      this.is_processing = true

      for (let idx = 0; idx < this.multiUploadProcessor; idx++) {
        console.log(process)
        // upload to s3
        this.s3Upload(this.queuedFiles[idx])
      }
    },
    processRemove (dt) {
      this.trash.push(dt)
      const deletedIndex = this.input.indexOf(dt)
      this.input.splice(deletedIndex, 1)
      this.checkIsFull()
    },
    commitImageRemoval () {
      if (this.trash.length === 0) { return }
      this.s3Delete(this.trash)
    },
    checkIsFull () {
      if (this.maxFile && (this.input.length + this.queuedFiles.length >= this.maxFile)) {
        this.is_full = true
      }
    }
  }
}
</script>

<style lang="scss">
@import "~/assets/scss/var.scss";

.box-input {
  display: flex;
  flex-wrap: wrap;
  background-color: $color-white;
  // outline: 1px dashed $color-secondary;
  outline-offset: -10px;
  padding: 1rem;

  .input-placeholder {
    .placeholder {
      border: 1px solid $color-clickable;
      width: 100px;
      height: 100px;
      margin: 0px;
      font-size: inherit;
      border-radius: $borderRadiusMedium;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $color-primary;

      &:hover {
        background-color: $color-action;
      }

      .group {
        display: grid;

        .placeholder-logo {
          height: 2.75rem;
          margin-bottom: .5rem;
        }
      }
    }
  }

    .preview-wrapper {
      width: 100px;
      height: 100px;
      border-radius: $borderRadiusMedium;
      border: 1px solid $color-clickable;

      img {
        border-radius: $borderRadiusMedium;
        height: 100%;
        width: 100%;
      }
  }
}
</style>
