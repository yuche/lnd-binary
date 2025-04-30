import fs from 'fs-extra'
import path from 'path'
import lnd from './extensions'
import createDebug from 'debug'
import pkg from './package'
const debug = createDebug(pkg.name)

// Cache the archive.
export const cache = (binaryPath, cachePath) => {
  debug('cache: %o', { binaryPath, cachePath })
  if (!cachePath) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const cachedBinary = path.join(cachePath, lnd.getBinaryName())

    debug('cachedBinary: %o', cachedBinary)

    try {
      fs.ensureDirSync(path.dirname(cachedBinary))
      fs.createReadStream(binaryPath)
        .pipe(fs.createWriteStream(cachedBinary, { mode: 0o755 }))
        .on('finish', () => {
          resolve()
        })
        .on('error', function (err) {
          reject(err)
        })
    } catch (err) {
      reject(err)
    }
  })
}
