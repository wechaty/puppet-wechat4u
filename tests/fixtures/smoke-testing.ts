#!/usr/bin/env ts-node

// tslint:disable:arrow-parens
// tslint:disable:max-line-length
// tslint:disable:member-ordering
// tslint:disable:no-shadowed-variable
// tslint:disable:unified-signatures
// tslint:disable:no-console

import {
  MemoryCard,
}                 from 'memory-card'

import {
  PuppetWechat4u,
}                 from 'wechaty-puppet-wechat4u'

async function main () {
  const puppet = new PuppetWechat4u({ memory: new MemoryCard() })
  console.log(`Puppet v${puppet.version()} smoking test passed.`)
  return 0
}

main()
.then(process.exit)
.catch(e => {
  console.error(e)
  process.exit(1)
})
