#!/usr/bin/env ts-node

// tslint:disable:arrow-parens
// tslint:disable:max-line-length
// tslint:disable:member-ordering
// tslint:disable:no-shadowed-variable
// tslint:disable:unified-signatures
// tslint:disable:no-console

import {
  PuppetWechat4u,
  log,
  VERSION,
}                 from 'wechaty-puppet-wechat4u'

log.level('silly')

async function main () {
  if (VERSION === '0.0.0') {
    throw new Error('should set VERSION to real before publishing')
  }
  const puppet = new PuppetWechat4u()
  const future = new Promise(resolve => puppet.once('scan', resolve))

  await puppet.start()
  await future

  log.info('SmokeTesting', 'main() event `scan` received!')

  await puppet.stop()

  log.info('SmokeTesting', `Puppet v${puppet.version()} smoke testing passed.`)
  return 0
}

main()
  .then(process.exit)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
