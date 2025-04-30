import fs from 'fs-extra'
import path from 'path'
import gunzip from 'gunzip-maybe'
import tar from 'tar-fs'
import unzip from 'unzip-stream'
import log from 'consola'
import support from './support'
import lnd from './extensions'
import createDebug from 'debug'
import pkg from './package'

const debug = createDebug(pkg.name)

// Extract the archive.
export const extract = (archive, dest) => {
  debug('extract: %o', { archive, dest })

  const archiveDir = path.dirname(archive)
  const archiveExtractedDir = archive.replace(lnd.getBinaryExtension(), '')
  const downloadedLndBinary = path.join(archiveExtractedDir, 'lnd' + lnd.getBinaryFileExtension())
  const isWindows = support.isWindows(lnd.getBinaryPlatform())
  const stream = fs.createReadStream(archive)

  const moveToDest = (cb) => {

    // Make sure the binary is executable.
    try {
      // avoid touching the binary if it's already got the correct permissions
      var st = fs.statSync(downloadedLndBinary)
      var mode = st.mode | parseInt('0755', 8)
      if (mode !== st.mode) {
        fs.chmodSync(downloadedLndBinary, mode)
      }
    } catch (error) {
      log.error(error)
      return cb(error)
    }
    fs.copyFileSync(downloadedLndBinary, dest)
    return cb()
  }

  return new Promise((resolve, reject) => {
    if (isWindows) {
      stream
        .pipe(unzip.Extract({ path: archiveDir }))
        .on('close', () => moveToDest(resolve))
        .on('error', reject)
    } else {
      stream
        .pipe(gunzip())
        .pipe(tar.extract(archiveDir))
        .on('finish', () => moveToDest(resolve))
        .on('error', reject)
    }
  })
}
