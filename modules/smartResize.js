/*
 ---------------
 docs
 ---------------
1. setTarget(width, height)
this function will set new target image dimension. default (500 x 500)
param: width of image, height of image

2. smartResize(blob, meta)
call this function to smart reize image.
param: blob data image, metadata of image

 */
import resizeImg from 'resize-img'

export default {
  target: {
    width: '500',
    height: '500'
  },
  setTarget (width, height) {
    this.target.width = width
    this.target.height = height
  },
  async resize (dt, meta) {
    // if (meta.height === meta.width) {
    // resize
    const res = await resizeImg(dt, {
      width: this.target.width,
      height: this.target.height
    })
    return res
    // } else {
    //   // crop
    // }
  }
}
