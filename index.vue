<template>
  <div
    v-cloak
    :class="'input-image ' + (is_full ? 'input-full' : '')"
    @drop.prevent="handleDroppedFile"
    @dragover.prevent="handleOnEnter"
    @dragleave.prevent="handleOnLeave"
  >
    <div class="box-input">
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
      <div v-for="(dt,i ) in input" :key="`uploaded-${i}`" :class="`preview-wrapper uploaded ${contentClass}`" @click="$emit('click', dt)">
        <img :src="dt" class="img">
        <div class="top-info" @click="removeFromInput(dt, i)">
          <img class="close-logo" :src="closeLogo">
        </div>
      </div>
      <div v-for="(dt,i ) in queuedFiles" :key="`queued-${i}`" :class="`preview-wrapper ${contentClass} ` + (!dt.is_uploading && !dt.is_error ? 'queueing' : 'uploading' )">
        <img :src="dt.preview" class="img">
        <!-- queueing  -->
        <div v-if="!(dt.is_uploading || dt.is_error)" class="bottom-info">
          <div class="content loading">
            <div class="progress" style="width: 0px;" />
          </div>
        </div>

        <!-- loading  -->
        <div v-if="dt.is_uploading" class="bottom-info">
          <div class="content loading">
            <div class="progress" :style="`width: ${dt.progress}%;`" />
          </div>
        </div>

        <!-- error -->
        <div v-if="dt.is_error" class="top-info" @click="removeFromQueue(i)">
          <img class="close-logo" :src="closeLogo">
        </div>
        <div v-if="dt.is_error" class="center-info" @click="handleInputRetry(i)">
          <img class="retry-logo" :src="retryLogo">
        </div>
        <div v-if="dt.is_error" class="bottom-info">
          <div class="content error">
            <p>{{ label.errors.general[lang] }}</p>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="withPlaceholder && !is_full"
      class="dropper"
    >
      <p class="droper-label">
        {{ label.placeholder[lang] }}
      </p>
    </div>
  </div>
</template>

<script>
import s3Mixin from './mixin/s3.js'
// import smartReize from './modules/smartResize.js'

export default {
  mixins: [
    s3Mixin
  ],
  props: {
    value: {
      default: () => { return [] },
      type: [Array, String]
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
    },
    withPlaceholder: {
      default: true,
      type: Boolean
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
      // multiUploadProcessor: 2,
      procPointer: 0,
      usedProcessor: 0,

      label: require('./assets/label.json'),
      placeholderLogo: require('./assets/placeholder.svg'),
      retryLogo: require('./assets/retry.svg'),
      closeLogo: require('./assets/close.svg')
    }
  },
  watch: {
    value (val) {
      if (!val) {
        this.input = []
      } else {
        this.input = typeof val === 'string' ? [val] : val
      }
      this.checkIsFull()
    }
  },
  created () {
    this.$on('uploaderUploaded', (res) => {
      // move uploaded file to model
      const finishedProcessIdx = this.queuedFiles.findIndex(function (_p) {
        return (_p.id === res.id)
      })
      this.input.push(res.uploaded_url)
      this.queuedFiles.splice(finishedProcessIdx, 1)
      this.usedProcessor -= parseInt(1)
      this.procPointer -= parseInt(1)
      this.$emit('input', this.input)

      // on s3 upload done, run next queue
      this.processQueue()
      // setTimeout(() => {
      //   this.processQueue()
      // }, 1100) // get auto name per seconnd (consider autonaming use milisecond to remove this temiout block)
    })
    this.$on('uploaderError', (error) => {
      // on s3 upload error, run next queue
      console.log('error', error)
      console.log('proc', this.procPointer)
      this.usedProcessor -= parseInt(1)
      if (this.is_processing) {
        this.processQueue()
      }
    })
  },
  mounted () {
    this.input = !this.value
      ? []
      : (
          typeof this.value === 'string'
            ? [this.value]
            : this.value
        )
    this.checkIsFull()
  },
  destroyed () {
    this.$off('uploaderUploaded')
    this.$off('uploaderError')
  },
  methods: {
    handleDroppedFile (evt) {
      evt.currentTarget.classList.remove('hovered')

      if (evt.dataTransfer.files.length > (this.maxFile - this.input.length)) {
        this.$emit('error', this.label.errors.max_file[this.lang])
        return
      }

      if (this.is_full === true) {
        this.$emit('error', this.label.errors.max_file[this.lang])
        return
      }

      evt.dataTransfer.files.forEach((dt) => {
        const extension = dt.type.replace(/(.*)\//g, '')
        if (this.allowedFileType && (this.allowedFileType.includes(extension))) {
          this.queuedFiles.push(this.uploaderMakeFileObject(dt, extension))
        } else {
          this.$emit('error', this.label.errors.invalid_file[this.lang])
        }
      })

      this.checkIsFull()
      this.processQueue()
    },
    handleInput (evt) {
      if (this.is_full === true) {
        this.$emit('error', this.label.errors.max_file[this.lang])
        return
      }

      // console.log('tes')
      // console.log(this.maxFile, this.input.length, this.queuedFiles.length)
      // console.log(evt.target.files)
      evt.target.files.forEach((dt) => {
        const extension = dt.type.replace(/(.*)\//g, '')
        this.queuedFiles.push(this.uploaderMakeFileObject(dt, extension))
      })

      this.checkIsFull()
      this.processQueue()
    },
    handleInputRetry (idx) {
      this.procPointer = idx

      for (let idx = 0; idx < this.queuedFiles.length; idx++) {
        const tmp = JSON.parse(JSON.stringify(this.queuedFiles[idx]))
        tmp.is_error = false
        tmp.is_uploading = false
        this.queuedFiles[idx] = tmp
      }

      this.processQueue()
    },
    processQueue () {
      if (this.queuedFiles.length === 0) {
        this.$emit('done', this.queuedFiles)
        return
      }

      // count processed data
      console.log('tes', this.procPointer, this.queuedFiles.length)
      // const nProc = this.queuedFiles.reduce(function (accum, val) {
      //   if (val.is_uploaded || val.is_error) {
      //     return accum + parseInt(1)
      //   } else {
      //     return accum
      //   }
      // }, 0)

      if (this.procPointer >= this.queuedFiles.length) {
        console.log('slesai')
        this.is_processing = false
        this.$emit('done', this.queuedFiles)
        return
      }
      if (!this.is_processing) {
        this.$emit('procesing', this.queuedFiles)
      }

      this.is_processing = true

      console.log('processor', this.multiUploadProcessor, this.usedProcessor)
      let lastTaskId = -1
      for (let idx = 0; idx < (this.multiUploadProcessor - this.usedProcessor); idx++) {
        // upload to s3
        function findTask (dt) {
          // console.log('check dt', dt, lastTaskId)
          if (dt[lastTaskId].is_uploading || dt[lastTaskId].is_error) {
            lastTaskId += parseInt(1)
            return findTask(dt)
          } else {
            return lastTaskId
          }
        }

        lastTaskId += parseInt(1)
        if (this.queuedFiles[lastTaskId]) {
          this.usedProcessor += parseInt(1)
          console.log('input', JSON.parse(JSON.stringify(this.queuedFiles)))
          const procId = findTask(JSON.parse(JSON.stringify(this.queuedFiles)))
          this.procPointer += parseInt(1)
          console.log('uploading', this.queuedFiles[procId])
          this.uploaderUpload(this.queuedFiles[procId])
        } else {
          console.error('task not found')
        }

        console.log('task id', lastTaskId)

        // console.log('processing', this.procPointer, this.queuedFiles[this.procPointer])
        // if (this.queuedFiles[this.procPointer]) {
        //   const ptr = this.procPointer
        //   this.usedProcessor += parseInt(1)
        //   this.procPointer += parseInt(1)
        //   this.uploaderUpload(this.queuedFiles[ptr])
        // }
      }
    },
    processRemove (dt) {
      this.trash.push(dt)
      const deletedIndex = this.input.indexOf(dt)
      this.input.splice(deletedIndex, 1)
      this.checkIsFull()
    },
    commitImageRemoval () {
      console.log('removing')
      if (this.trash.length === 0) { return }
      this.uploaderDelete(this.trash)
    },
    checkIsFull () {
      console.log(this.maxFile, (this.input.length + this.queuedFiles.length))
      this.is_full = (this.maxFile && (this.input.length + this.queuedFiles.length >= this.maxFile))
    },

    handleOnEnter (evt) {
      evt.currentTarget.classList.add('hovered')
    },
    handleOnLeave (evt) {
      evt.currentTarget.classList.remove('hovered')
    },
    removeFromInput (dt, i) {
      this.trash.push(dt)
      this.input.splice(i, 1)
      this.$emit('remove', this.input[i])
    },
    removeFromQueue (i) {
      this.queuedFiles.splice(i, 1)
      this.procPointer -= parseInt(1)
      // this.processQueue()
    }
  }
}
</script>

<style lang="scss">
@import "~/assets/scss/var.scss";

.input-image {
  -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
     -khtml-user-select: none; /* Konqueror HTML */
       -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
            user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
  border: 2px dashed $color-white;
  border-radius: $borderRadiusMedium;
}

.hovered {
  &:not(.input-full) {
    border: 2px dashed $color-secondary;
    border-radius: $borderRadiusMedium;

    .box-input {
      -webkit-filter: blur(5px);
      -moz-filter: blur(5px);
      -o-filter: blur(5px);
      -ms-filter: blur(5px);
      filter: blur(5px);
      cursor: copy;
    }
  }

  .box-input {
    &.input-full {
      cursor: no-drop;
    }
  }
}

.dropper {
  padding-left: 1rem;
  padding-right: 1rem;
  padding-bottom: .5rem;
  padding-top: .5rem;
  border-top: 1px solid $color-action;
  border-bottom-left-radius: $borderRadiusMedium;
  border-bottom-right-radius: $borderRadiusMedium;
  background-color: $color-white;

  .droper-label {
    width: 100%;
    font-size: .75rem;
    font-weight: 400;
    text-align: center;
    margin-bottom: 0px;
  }
}

.box-input {
  display: flex;
  flex-wrap: wrap;
  background-color: $color-white;
  outline-offset: -10px;
  // padding: 1rem;
  padding: 1rem;
  padding-bottom: 0px;

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
    display: grid;

    &.queueing {
      opacity: .50;
    }

    &.uploading {
      opacity: .80;
    }

    &.uploaded {
      cursor: pointer;
    }

    .top-info {
      padding: 3px;
      margin-top: -98px;
      height: 20px;
      display: flex;
      justify-content: flex-end;

      .close-logo {
        background: white;
        border-radius: 5px;
        width: 15px;
        height: 15px;
        opacity: .6;
        padding: 3px;

        &:hover {
          opacity: 1;
        }
      }
    }

    .center-info {
      display: flex;
      justify-content: center;
      height: 60px;
      margin-top: -65px;
      display: flex;
      align-content: center;

      .retry-logo {
        background: white;
        border-radius: 5px;
        height: 30px;
        width: 30px;
        padding: 6px;
        cursor: pointer;
        opacity: .6;

        &:hover {
          opacity: 1;
        }
      }
    }

    .bottom-info {
      padding: 3px;
      margin-top: -19px;
      height: 20px;
      // border-bottom-left-radius: $borderRadiusMedium;
      // border-bottom-right-radius: $borderRadiusMedium;

      .content {
        margin-bottom: 0px;
        background-color: $color-secondary;
        border-radius: 5px;
        padding: 1px;

        p {
          font-size: 9px;
          line-height:6px;
          margin-bottom: 0px
        }

        &.loading {
          .progress {
            height: 9px;
            background-color: white;
          }
        }

        &.error {
            height: 9px;
            background-color: #ff4d4d;

            p{
              text-align: center;
              color:white;
            }
        }
      }
    }

    img {
      border-radius: $borderRadiusMedium;
      height: 98px;
      width: 98px;
      background-color: $color-action;
    }
  }
}

</style>
