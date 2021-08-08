import AWS from 'aws-sdk'

export default {
  data () {
    return {
      s3: new AWS.S3(require('~/json/dospace').s3Object),
      s3Params: require('~/json/dospace').params
    }
  },
  methods: {
    s3Upload (s3FileObject, filename) {
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
        vm.$emit('s3Uploaded', s3FileObject)
      }

      function handleError (error) {
        s3FileObject.error = error
        s3FileObject.is_error = true
        s3FileObject.progress = 0
        s3FileObject.is_uploading = false
        vm.$emit('s3UploadError', s3FileObject)
      }

      // upload s3
      try {
        const params = {
          Bucket: this.s3Params.Bucket,
          Key: filename
            ? (this.s3Params.Key + filename + '.' + s3FileObject.ext)
            : (this.s3Params.Key + s3FileObject.id + '.' + s3FileObject.ext),
          Body: s3FileObject.data,
          ACL: 'public-read',
          ContentType: 'image/jpeg'
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
    s3Delete (urls) {
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
    s3MakeFileObject (data, ext, isBase64) {
      if (!ext || !data) {
        console.error('no data or file extension on s3MakeFileObject')
        return
      }

      return {
        id: new Date().getTime(),
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
    s3FromBase64 (b64) {
      return Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    }
  }
}
