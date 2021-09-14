#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import {
  PuppetWechat4u,
  log,
  VERSION,
}                 from 'wechaty-puppet-wechat4u'

log.level('silly')

async function main () {
  const puppet = new PuppetWechat4u()
  const future = new Promise(resolve => puppet.once('scan', resolve))

  await puppet.start()
  await future

  log.info('SmokeTesting', 'main() event `scan` received!')

  await puppet.stop()

  if (VERSION === '0.0.0') {
    throw new Error('should set VERSION to real before publishing')
  }

  log.info('SmokeTesting', `Puppet v${puppet.version()} smoke testing passed.`)
  return 0
}

main()
  .then(process.exit)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
