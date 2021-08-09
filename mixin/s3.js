import AWS from 'aws-sdk'

export default {
  data () {
    return {
      s3: new AWS.S3(require('~/json/dospace.json').s3Object),
      s3Params: require('~/json/dospace.json').s3Params
    }
  },
  methods: {
    uploaderUpload (s3FileObject, filename) {
      if (s3FileObject && s3FileObject.is_uploading) {
        return
      }

      const vm = this

      // init object state
      s3FileObject.is_uploading = true
      s3FileObject.is_error = false
      s3FileObject.error = ''

      // handlers
      function handleDone (url) {
        s3FileObject.progress = 0
        s3FileObject.uploaded_url = url
        s3FileObject.is_error = false
        s3FileObject.is_uploading = false
        vm.$emit('uploaderUploaded', s3FileObject)
      }

      function handleError (error) {
        s3FileObject.error = error
        s3FileObject.is_error = true
        s3FileObject.progress = 0
        s3FileObject.is_uploading = false
        vm.$emit('uploaderError', s3FileObject)
      }

      // upload s3
      try {
        const params = {
          Bucket: this.s3Params.Bucket,
          Key: filename
            ? (this.s3Params.Key + filename + '.' + s3FileObject.ext)
            : (this.s3Params.Key + s3FileObject.id + '.' + s3FileObject.ext),
          Body: s3FileObject.data,
          ACL: this.s3Params.ACL,
          ContentType: this.s3Params.ContentType
        }
        // console.log('chekc param', params)
        this.s3.upload(params, function (err, res) {
          if (err) {
            handleError(err)
          } else {
            handleDone(res.Location)
          }
        })
          .on('httpUploadProgress', function (progress) {
            s3FileObject.progress = Math.round(progress.loaded / progress.total * 100)
          })
      } catch (err) {
        handleError(err)
      }
    },
    uploaderDelete (urls) {
      const params = {
        Bucket: this.s3Params.Bucket,
        // Key: 'basil/' + tmp[tmp.length - 1]
        Delete: {
          Objects: urls.map((url) => {
            const tmp = url.split('/')
            return { Key: this.s3Params.Key + tmp[tmp.length - 1] }
          })
        }
      }
      //   console.log(params)

      this.s3.deleteObjects(params, function (err, data) {
        if (err) {
          console.log(err, err.stack)
        } else {
          console.log(data)
        }
      })
    },
    uploaderMakeFileObject (data, ext, isBase64) {
      if (!ext || !data) {
        console.error('no data or file extension on s3MakeFileObject')
        return
      }

      const dt = new Date()
      const randomizer = (Math.floor(Math.random() * 10000) + 10000).toString().substring(1)

      return {
        id: dt.getTime() + dt.getMilliseconds() + randomizer,
        preview: isBase64 ? data : URL.createObjectURL(data),
        data,
        filename: '',
        progress: 0,
        is_uploading: false,
        is_error: false,
        is_uploaded: false,
        error: '',
        uploaded_url: '',
        ext
      }
    },
    uploaderFromBase64 (b64) {
      return Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    }
  }
}
