import * as PUPPET from 'wechaty-puppet'
import type { WebContactRawPayload } from '../../web-schemas.js'
import { log } from 'wechaty-puppet'

export function wechat4uContactToWechaty (rawPayload: WebContactRawPayload): PUPPET.payloads.Contact {
  log.silly('PuppetWechat4u', 'contactParseRawPayload(Object.keys(payload).length=%d)',
    Object.keys(rawPayload).length,
  )
  if (!Object.keys(rawPayload).length) {
    log.error('PuppetWechat4u', 'contactParseRawPayload(Object.keys(payload).length=%d)',
      Object.keys(rawPayload).length,
    )
    log.error('PuppetWechat4u', 'contactParseRawPayload() got empty rawPayload!')
    throw new Error('empty raw payload')
    // return {
    //   gender: Gender.Unknown,
    //   type:   Contact.Type.Unknown,
    // }
  }

  // this.id = rawPayload.UserName   // MMActualSender??? MMPeerUserName???
  // `getUserContact(message.MMActualSender,message.MMPeerUserName).HeadImgUrl`
  // uin:        rawPayload.Uin,    // stable id: 4763975 || getCookie("wxuin")

  return {
    address:    rawPayload.Alias, // XXX: need a stable address for user
    alias:      rawPayload.RemarkName,
    avatar:     rawPayload.HeadImgUrl,
    city:       rawPayload.City,
    friend:     rawPayload.stranger === undefined
      ? undefined
      : !rawPayload.stranger, // assign by injectio.js
    gender:     rawPayload.Sex,
    id:         rawPayload.UserName,
    name:       rawPayload.NickName || '',
    phone:      [],
    province:   rawPayload.Province,
    signature:  rawPayload.Signature,
    star:       !!rawPayload.StarFriend,
    weixin:     rawPayload.Alias,  // Wechat ID

    // tslint:disable:max-line-length
    /**
     * @see 1. https://github.com/Chatie/webwx-app-tracker/blob/7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L3243
     * @see 2. https://github.com/Urinx/WeixinBot/blob/master/README.md
     * @ignore
     */
    // eslint-disable-next-line sort-keys
    type:      (!!rawPayload.UserName && !rawPayload.UserName.startsWith('@@') && !!(rawPayload.VerifyFlag & 8))
      ? PUPPET.types.Contact.Official
      : PUPPET.types.Contact.Individual,
    /**
     * @see 1. https://github.com/Chatie/webwx-app-tracker/blob/7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L3246
     * @ignore
     */
    // special:       specialContactList.indexOf(rawPayload.UserName) > -1 || /@qqim$/.test(rawPayload.UserName),
  }
}
