#!/usr/bin/env ts-node

// tslint:disable:no-shadowed-variable
import test  from 'blue-tape'

import { PuppetWechat4u } from './puppet-wechat4u'

class PuppetWechat4uTest extends PuppetWechat4u {
}

test('PuppetWechat4u restart without problem', async (t) => {
  const puppet = new PuppetWechat4uTest()
  try {
    for (let i = 0; i < 3; i++) {
      await puppet.start()
      await puppet.stop()
      t.pass('start/stop-ed at #' + i)
    }
    t.pass('PuppetWechat4u() start/restart successed.')
  } catch (e) {
    t.fail(e)
  }
})
