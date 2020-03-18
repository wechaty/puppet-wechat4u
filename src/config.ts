// tslint:disable:no-reference

/// <reference path="./typings.d.ts" />

import {
  // Brolog,
  log,
}                   from 'brolog'
import { FileBox }  from 'wechaty-puppet'

import { OperationOptions } from 'retry'
import promiseRetry = require('promise-retry')

// export const log = new Brolog()

export function qrCodeForChatie (): FileBox {
  const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5'
  return FileBox.fromQRCode(CHATIE_OFFICIAL_ACCOUNT_QRCODE)
}

export async function retry<T> (
  retryableFn: (
    retry: (error: Error) => never,
    attempt: number,
  ) => Promise<T>,
): Promise<T> {
  /**
   * 60 seconds: (to be confirmed)
   *  factor: 3
   *  minTimeout: 10
   *  maxTimeout: 20 * 1000
   *  retries: 9
   */
  const factor     = 3
  const minTimeout = 10
  const maxTimeout = 20 * 1000
  const retries    = 9
  // const unref      = true

  const retryOptions: OperationOptions = {
    factor,
    maxTimeout,
    minTimeout,
    retries,
  }
  return promiseRetry(retryOptions, retryableFn)
}

/**
 * VERSION
 */
export { VERSION } from './version'

export {
  log,
}
