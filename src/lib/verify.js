import fs from 'fs-extra'
import path from 'path'
import { hashFile } from 'hasha'
import log from 'consola'
import axios from 'axios'
import lnd, { DEFAULT_BINARY_URL } from '../lib/extensions'
import pkg from './package'

import createDebug from 'debug'

const debug = createDebug(pkg.name)

// 从在线manifest文件解析校验和
const parseManifestFile = (content, binaryName) => {
  const lines = content.split('\n')
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 2) {
      const hash = parts[0]
      const file = parts[1]
      
      if (file === binaryName) {
        return hash
      }
    }
  }
  return null
}

// Verify the binary archive.
export const verify = (filepath) => {
  debug('verify: %o', { filepath })

  function getKeyByValue(object, value) {
    return Object.keys(object).find((key) => object[key] === value)
  }

  const binaryVersion = lnd.getBinaryVersion()
  const binaryName = lnd.getBinaryName() + lnd.getBinaryExtension()
  
  // 当使用自定义下载地址时跳过验证
  if (lnd.getBinarySite() !== DEFAULT_BINARY_URL) {
    log.warn(`Skipping checksum validation. Unknown binary site.`)
    return Promise.resolve()
  }
  
  // 尝试从GitHub下载manifest文件
  const manifestUrl = `${DEFAULT_BINARY_URL}/v${binaryVersion}/manifest-v${binaryVersion}.txt`
  debug(`Trying to download manifest from: ${manifestUrl}`)
  
  return axios.get(manifestUrl)
    .then(response => {
      const content = response.data
      debug('Downloaded manifest file successfully')
      
      // 从manifest文件解析出校验和
      const checksum = parseManifestFile(content, binaryName)
      
      if (!checksum) {
        log.warn(`Could not find checksum for ${binaryName} in online manifest`)
        if (process.env.LND_BINARY_SKIP_VERIFY === 'true') {
          log.warn(`LND_BINARY_SKIP_VERIFY is set to true. Skipping verification.`)
          return Promise.resolve()
        }
        return Promise.reject(new Error(`Could not find checksum for ${binaryName}`))
      }
      
      debug('Verifying archive against online checksum', checksum)
      
      return hashFile(filepath, { algorithm: 'sha256' })
        .then((hash) => {
          debug('Generated hash from downloaded file', hash)

          if (checksum === hash) {
            log.info(pkg.name, 'Verified checksum of downloaded file against online manifest')
            return filepath
          }
          
          log.error(pkg.name, 'Checksum did not match online manifest')
          
          if (process.env.LND_BINARY_SKIP_VERIFY === 'true') {
            log.warn(`LND_BINARY_SKIP_VERIFY is set to true. Proceeding despite checksum mismatch.`)
            return filepath
          }
          
          return Promise.reject(new Error('Checksum did not match online manifest'))
        })
    })
    .catch(err => {
      debug('Failed to verify using online manifest:', err.message)
      log.warn(`Could not verify against online manifest: ${err.message}`)
      
      if (process.env.LND_BINARY_SKIP_VERIFY === 'true') {
        log.warn(`LND_BINARY_SKIP_VERIFY is set to true. Skipping verification.`)
        return Promise.resolve()
      }
      
      log.warn(`If you want to skip verification, set the environment variable LND_BINARY_SKIP_VERIFY=true`)
      return Promise.reject(new Error(`Verification failed: ${err.message}`))
    })
}
