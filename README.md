# vue-inputImage
input fileimage with auto upload to AWS s3 service and v-model binding, support bootstrap 4


### Installation
  to configure your bucket configuration, please go to mixin/s3.js and change default path with you confguration json path

      s3: new AWS.S3(require('yourconfig.json').s3Object),
      s3Params: require('yourconfig.json').s3Params
      
  json config temlate is present in /templateConfig.json

### Example

        <inputImage
          ref="inputThumbnail"
          v-model="input.thumbnail"
          :max-file="1"
          content-class="mb-3 mr-3"
          @remove="handleRemove"
          @input="handleInput"
        />
        
        data () {
          return {
            input: {
              thumbnail: []
            }
          }
        },
        methods: {
          handleRemove () {
            this.$refs.inputThumbnail.commitImageRemoval() // delete removed file from aws
          },
          handleInput (dt) {
            console.log('input data', dt)
          }
        }
