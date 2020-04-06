/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
// tslint:disable:member-ordering
// tslint:disable:arrow-parens

import LRUCache from 'lru-cache'

import Wechat4u from 'wechat4u'

import {
  ContactPayload,
  ContactType,

  FriendshipPayload,
  FriendshipPayloadConfirm,
  FriendshipPayloadReceive,
  FriendshipType,

  MessagePayload,

  Puppet,
  PuppetOptions,

  FileBox,

  RoomInvitationPayload,

  RoomMemberPayload,
  RoomPayload,

  throwUnsupportedError,

  UrlLinkPayload,
  MiniProgramPayload,
  ImageType,
  ScanStatus,
}                         from 'wechaty-puppet'

import {
  log,
  qrCodeForChatie,
  retry,
  VERSION,
}                       from './config'

import {
  WebContactRawPayload,
  WebMessageRawPayload,
  WebMessageType,
  WebRecomendInfo,
  WebRoomRawMember,
  WebRoomRawPayload,
}                           from './web-schemas'

import {
  messageRawPayloadParser,
}                           from './pure-function-helpers'

// export interface Wechat4uContactRawPayload {
//   name : string,
// }

// export interface WebMessageRawPayload {
//   id   : string,
//   from : string,
//   to   : string,
//   text : string
// }

// export interface Wechat4uRoomRawPayload {
//   topic      : string,
//   memberList : string[],
//   ownerId    : string,
// }

// MemoryCard Slot Name
const MEMORY_SLOT_NAME = 'PUPPET-WECHAT4U'

export class PuppetWechat4u extends Puppet {

  public static readonly VERSION = VERSION

  /**
   * Wecaht4u
   *
   * Code from:
   * https://github.com/nodeWechat/wechat4u/blob/46931e78bcb56899b8d2a42a37b919e7feaebbef/run-core.js
   *
   */
  private wechat4u?: any

  private scanQrCode?: string

  private readonly cacheMessageRawPayload: LRUCache<string, WebMessageRawPayload>

  constructor (
    public options: PuppetOptions = {},
  ) {
    super(options)

    const lruOptions: LRUCache.Options<string, any> = {
      // length: function (n) { return n * 2},
      dispose (key: string, val: object) {
        log.silly('PuppetWechat4u', 'constructor() lruOptions.dispose(%s, %s)', key, JSON.stringify(val))
      },
      max: 10000,
      maxAge: 1000 * 60 * 60,
    }

    this.cacheMessageRawPayload = new LRUCache<string, WebMessageRawPayload>(lruOptions)
  }

  public async start (): Promise<void> {
    log.verbose('PuppetWechat4u', `start() with ${this.memory.name}`)

    this.state.on('pending')

    if (this.wechat4u) {
      log.warn('PuppetWechat4u', 'start() wechat4u exist, will be overwrited')
    }

    const syncData = await this.memory.get(MEMORY_SLOT_NAME)
    if (syncData) {
      this.wechat4u = new Wechat4u(syncData)
    } else {
      this.wechat4u = new Wechat4u()
    }

    this.monkeyPatch(this.wechat4u)

    this.initHookEvents(this.wechat4u)

    /**
     * Should not `await` start/restart for wechat4u
     * because it will blocks...
     */
    if (this.wechat4u.PROP.uin) {
      // 存在登录数据时，可以随时调用restart进行重启
      this.wechat4u.restart()
    } else {
      this.wechat4u.start()
    }

    // await some tasks...
    this.state.on(true)

  }

  private monkeyPatch (wechat4u: any) {
    log.silly('PuppetWechat4u', 'monkeyPatch()')

    // fake wechat4u to think as we had logined.)
    this.monkeyPatchOffState(wechat4u, 'checkLogin', Promise.resolve({ code: 200 }))
    this.monkeyPatchOffState(wechat4u, 'login',      Promise.resolve())
    this.monkeyPatchOffState(wechat4u, '_init',      Promise.resolve())

    this.monkeyPatchHook(
      wechat4u,
      'syncCheck',
      () => {
        log.silly('PuppetWechat4u', 'monkeyPatch() monkeyPatchHook() wechat4u.syncCheck()')
        this.emit('watchdog', { data: 'syncCheck()' })
      },
    )

    /**
     * Disable Wechat4u for Sending Message to Filehelper when Heartbeat.
     */
    // tslint:disable-next-line
    // console.log(Object.keys(wechat4u))

    // tslint:disable-next-line:no-string-literal
    wechat4u['checkPolling'] = () => {
      log.silly('PuppetWechat4u', 'monkeyPatch() wechat4u.checkPolling()')
      if (this.state.off()) {
        return
      }
      wechat4u.notifyMobile()
        .catch((err: Error) => {
          log.warn('PuppetWechat4u', 'monkeyPatch() wechat4u.checkPolling() notifyMobile() exception: %s', err)
          wechat4u.emit('error', err)
        })
      clearTimeout(wechat4u.checkPollingId)
      wechat4u.checkPollingId = setTimeout(() => wechat4u.checkPolling(), wechat4u._getPollingInterval())
    }

    // 自定义心跳间隔（以毫秒为单位）
    // 25 days: https://stackoverflow.com/a/12633556/1123955
    // this.wechat4u.setPollingIntervalGetter(() => Math.pow(2,31) - 1)

  }

  /**
   * Monkey Patch for Wechat4u
   *  - https://www.audero.it/blog/2016/12/05/monkey-patching-javascript/#what-is-monkey-patching
   *
   * What is Monkey patching?
   *  Monkey patching is a technique to add, modify, or suppress
   *  the default behavior of a piece of code at runtime
   *  without changing its original source code.
   */
  private monkeyPatchOffState (wechat4u: any, func: string, valueWhenLogouted: any): void {
    log.verbose('PuppetWechat4u', 'monkeyPatchOffState(wechat4u, %s)', func)

    const puppetThis = this

    const funcOrig = wechat4u[func]
    function funcNew (this: any) {
      log.verbose('PuppetWechat4u', 'monkeyPatchOffState(%s) funcNew()', func)

      if (puppetThis.state.off()) {
        log.verbose('PuppetWechat4u', 'monkeyPatchOffState(%s) funcNew() state.off() is true, return', func)
        return valueWhenLogouted
      }
      return funcOrig.call(this)
    }
    wechat4u[func] = funcNew
  }

  private monkeyPatchHook (wechat4u: any, func: string, hookFunc: () => void): void {
    log.verbose('PuppetWechat4u', 'monkeyPatchHook(wechat4u, %s, func)', func)

    const funcOrig = wechat4u[func]
    function funcNew (this: any) {
      log.silly('PuppetWechat4u', 'monkeyPatchHook(wechat4u, %s, func) funcNew()', func)
      hookFunc()
      return funcOrig.call(this)
    }
    wechat4u[func] = funcNew
  }

  private initHookEvents (wechat4u: any) {
    log.verbose('PuppetWechat4u', 'initHookEvents()')
    /**
     * uuid事件，参数为uuid，根据uuid生成二维码
     */
    this.wechat4u.on('uuid', (uuid: string) => {
      log.silly('PuppetWechat4u', 'initHookEvents() wechat4u.on(uuid)')

      this.scanQrCode = 'https://login.weixin.qq.com/l/' + uuid
      this.emit('scan', { qrcode: this.scanQrCode, status: ScanStatus.Waiting })
    })
    /**
     * 登录用户头像事件，手机扫描后可以得到登录用户头像的Data URL
     */
    wechat4u.on('user-avatar', (avatarDataUrl: string) => {
      this.emit('scan', {
        data: avatarDataUrl,
        qrcode: this.scanQrCode || '',
        status: ScanStatus.Scanned,
      })
    })
    /**
     * 登录成功事件
     */
    wechat4u.on('login', async () => {
      // FIXME: where's the logined user id?
      const userId = this.wechat4u.user.UserName
      if (!userId) {
        this.emit('error', { data: 'login event can not found selfId' })
        return
      }
      await this.login(userId)
      // 保存数据，将数据序列化之后保存到任意位置
      await this.memory.set(MEMORY_SLOT_NAME, wechat4u.botData)
      await this.memory.save()
    })
    /**
     * 登出成功事件
     */
    wechat4u.on('logout', async () => {
      if (this.logonoff()) {
        await this.logout()
      }
      // 清除数据
      await this.memory.delete(MEMORY_SLOT_NAME)
      await this.memory.save()
    })
    /**
     * 联系人更新事件，参数为被更新的联系人列表
     */
    wechat4u.on('contacts-updated', (contacts: WebContactRawPayload[]) => {
      log.silly('PuppetWechat4u', 'initHookEvents() wechat4u.on(contacts-updated) new/total contacts.length=%d/%d',
        contacts.length,
        Object.keys(wechat4u.contacts).length,
      )
    })
    /**
     * 错误事件，参数一般为Error对象
     */
    wechat4u.on('error', (err: Error) => {
      this.emit('error', { data: err.message || String(err) })
    })

    /**
     * 如何处理会话消息
     */
    wechat4u.on('message', (msg: WebMessageRawPayload) => {

      if (!msg.MsgId) {
        log.warn('PuppetWechat4u', 'initHookEvents() wechat4u.on(message) no message id: %s', JSON.stringify(msg))
        throw new Error('no id')
      }
      this.cacheMessageRawPayload.set(msg.MsgId, msg)

      switch (msg.MsgType) {

        case WebMessageType.STATUSNOTIFY:
          // Skip this internal type
          break

        case WebMessageType.VERIFYMSG:
          this.emit('friendship', { friendshipId: msg.MsgId })
          break

        case WebMessageType.SYS:
          if (this.isFriendConfirm(msg.Content)) {
            this.emit('friendship', { friendshipId: msg.MsgId })
          }
          this.emit('message', { messageId: msg.MsgId })
          break

        default:
          this.emit('message', { messageId: msg.MsgId })
          break
      }
      /**
       * 获取消息时间
       */
      // console.log(`----------${msg.getDisplayTime()}----------`)
      /**
       * 获取消息发送者的显示名
       */
      // console.log(wechat4u.contacts[msg.FromUserName].getDisplayName())
    })
  }

  public async stop (): Promise<void> {
    log.verbose('PuppetWechat4u', 'stop()')

    if (this.state.off()) {
      log.warn('PuppetWechat4u', 'quit() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }

    this.state.off('pending')

    this.wechat4u.stop()
    this.wechat4u = undefined

    this.state.off(true)
  }

  public async logout (): Promise<void> {
    log.verbose('PuppetWechat4u', 'logout()')

    if (!this.id) {
      throw new Error('logout before login?')
    }

    this.emit('logout', {
      contactId: this.id,
      data: 'logout()',
    }) // becore we will throw above by logonoff() when this.user===undefined
    this.id = undefined

    // TODO: do the logout job
  }

  public async ding (data: string): Promise<void> {
    log.silly('PuppetWechat4u', 'ding(%s)', data || '')

    this.emit('dong', { data })
  }

  private isFriendConfirm (
    text: string,
  ): boolean {
    const friendConfirmRegexpList = [
      /^You have added (.+) as your WeChat contact. Start chatting!$/,
      /^你已添加了(.+)，现在可以开始聊天了。$/,
      /^(.+) just added you to his\/her contacts list. Send a message to him\/her now!$/,
      /^(.+)刚刚把你添加到通讯录，现在可以开始聊天了。$/,
    ]

    let found = false

    friendConfirmRegexpList.some(re => !!(found = re.test(text)))

    return found
  }

  public unref (): void {
    log.verbose('PuppetWechat4u', 'unref()')
    super.unref()
    // TODO: unref wechat4u
  }

  /**
   *
   * ContactSelf
   *
   *
   */
  public async contactSelfQRCode (): Promise<string> {
    return throwUnsupportedError()
  }

  public async contactSelfName (name: string): Promise<void> {
    return throwUnsupportedError(name)
  }

  public async contactSelfSignature (signature: string): Promise<void> {
    return throwUnsupportedError(signature)
  }

  /**
   *
   * Contact
   *
   */
  public contactAlias (contactId: string)                      : Promise<string>
  public contactAlias (contactId: string, alias: null | string): Promise<void>

  public async contactAlias (contactId: string, alias?: null | string): Promise<void | string> {
    log.verbose('PuppetWechat4u', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      const payload = await this.contactPayload(contactId)
      return payload.alias
    }

    await this.wechat4u.updateRemarkName(contactId, alias)
  }

  public async contactList (): Promise<string[]> {
    log.verbose('PuppetWechat4u', 'contactList()')

    const idList = this.wechat4u.contacts
      .filter((contact: any) => !contact.isRoomContact())
      .map(
        (rawPayload: WebContactRawPayload) => rawPayload.UserName,
      )
    return idList
  }

  public async contactQrcode (contactId: string): Promise<string> {
    return throwUnsupportedError(contactId)
  }

  public async contactAvatar (contactId: string)                : Promise<FileBox>
  public async contactAvatar (contactId: string, file: FileBox) : Promise<void>

  public async contactAvatar (contactId: string, file?: FileBox): Promise<void | FileBox> {
    log.verbose('PuppetWechat4u', 'contactAvatar(%s)', contactId)

    if (file) {
      return throwUnsupportedError()
    }

    const rawPayload = await this.contactRawPayload(contactId)
    const payload    = await this.contactPayload(contactId)

    const name = payload.name

    const res = await this.wechat4u.getHeadImg(rawPayload.HeadImgUrl)
    /**
     * 如何获取联系人头像
     */
    return FileBox.fromStream(
      res.data,
      `wechaty-contact-avatar-${name}.jpg`, // FIXME
    )
  }

  public async contactRawPayload (contactId: string): Promise<WebContactRawPayload> {
    log.verbose('PuppetWechat4u', 'contactRawPayload(%s) with contacts.length=%d',
      contactId,
      Object.keys(this.wechat4u.contacts).length,
    )

    if (!(contactId in this.wechat4u.contacts)) {
      try {
        const userDataList = [
          {
            EncryChatRoomId : '',
            UserName        : contactId,
          },
        ]
        const result = await this.wechat4u.batchGetContact(userDataList)

        log.silly('PuppetWechat4u', 'contactRawPayload(%s) wechat4u.batchGetContact() result: %s',
          JSON.stringify(result),
        )

        this.wechat4u.updateContacts(result)
      } catch (e) {
        log.warn('PuppetWechat4u', 'contactRawPayload(%s) wechat4u.batchGetContact() exception: %s', e)
      }
    }

    const rawPayload: WebContactRawPayload = await retry<WebContactRawPayload>(async (retryException, attempt) => {
      log.verbose('PuppetWechat4u', 'contactRawPayload(%s) retry() attempt=%d', contactId, attempt)

      if (contactId in this.wechat4u.contacts) {
        return this.wechat4u.contacts[contactId]
      }

      retryException(new Error('no this.wechat4u.contacts[' + contactId + ']'))
    })

    return rawPayload
  }

  public async contactRawPayloadParser (
    rawPayload: WebContactRawPayload,
  ): Promise<ContactPayload> {
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
        ? ContactType.Official
        : ContactType.Personal,
      /**
       * @see 1. https://github.com/Chatie/webwx-app-tracker/blob/7c59d35c6ea0cff38426a4c5c912a086c4c512b2/formatted/webwxApp.js#L3246
       * @ignore
       */
      // special:       specialContactList.indexOf(rawPayload.UserName) > -1 || /@qqim$/.test(rawPayload.UserName),
    }
  }

  /**
   *
   * Message
   *
   */
  public async messageContact (
    messageId: string,
  ): Promise<string> {
    log.verbose('PuppetWechat4u', 'messageContact(%s)', messageId)
    return throwUnsupportedError()
  }

  public async messageRecall (
    messageId: string,
  ): Promise<boolean> {
    log.verbose('PuppetWechat4u', 'messageRecall(%s)', messageId)
    return throwUnsupportedError()
  }

  public async messageImage (
    messageId: string,
    imageType: ImageType,
  ) : Promise<FileBox> {
    log.verbose('PuppetWechat4u', 'messageImage(%s, %s[%s])',
      messageId,
      imageType,
      ImageType[imageType],
    )
    return throwUnsupportedError()
  }

  public async messageFile (id: string): Promise<FileBox> {
    log.verbose('PuppetWechat4u', 'messageFile(%s)', id)

    const payload = await this.messagePayload(id)
    const rawPayload = await this.messageRawPayload(id)

    const filename = payload.filename || 'unknown.txt'

    /**
     * 判断消息类型
     */
    switch (rawPayload.MsgType) {
      case this.wechat4u.CONF.MSGTYPE_TEXT:
        /**
         * 文本消息
         */
        throw new Error('msg type is text')

      case this.wechat4u.CONF.MSGTYPE_EMOTICON:
        /**
         * 表情消息
         */
      // eslint-disable-next-lint no-fallthrough
      case this.wechat4u.CONF.MSGTYPE_IMAGE:
        /**
         * 图片消息
         */
        // console.log('图片消息，保存到本地')
        return FileBox.fromStream(
          (await this.wechat4u.getMsgImg(rawPayload.MsgId)).data,
          filename,
        )

      case this.wechat4u.CONF.MSGTYPE_VOICE:
        /**
         * 语音消息
         */
        // console.log('语音消息，保存到本地')
        return FileBox.fromStream(
          (await this.wechat4u.getVoice(rawPayload.MsgId)).data,
          filename,
        )

      case this.wechat4u.CONF.MSGTYPE_VIDEO:
      case this.wechat4u.CONF.MSGTYPE_MICROVIDEO:
        /**
         * 视频消息
         */
        // console.log('视频消息，保存到本地')
        return FileBox.fromStream(
          (await this.wechat4u.getVideo(rawPayload.MsgId)).data,
          filename,
        )

      case this.wechat4u.CONF.MSGTYPE_APP:
        if (rawPayload.AppMsgType === 6) {
          /**
           * 文件消息
           */
          // console.log('文件消息，保存到本地')
          return FileBox.fromStream(
            (await this.wechat4u.getDoc(rawPayload.FromUserName, rawPayload.MediaId, rawPayload.FileName)).data,
            filename,
          )
        }
        break
      default:
        break
    }

    throw new Error('unsupported message. id: ' + id)
  }

  public async messageUrl (messageId: string)  : Promise<UrlLinkPayload> {
    return throwUnsupportedError(messageId)
  }

  public async messageMiniProgram (messageId: string): Promise<MiniProgramPayload> {
    log.verbose('PuppetWechat4u', 'messageMiniProgram(%s)', messageId)
    return throwUnsupportedError(messageId)
  }

  public async messageRawPayload (id: string): Promise<WebMessageRawPayload> {
    log.verbose('PuppetWechat4u', 'messageRawPayload(%s)', id)

    const rawPayload = this.cacheMessageRawPayload.get(id)

    if (!rawPayload) {
      throw new Error('id not found')
    }
    return rawPayload
  }

  public async messageRawPayloadParser (
    rawPayload: WebMessageRawPayload,
  ): Promise<MessagePayload> {
    log.verbose('PuppetWechat4u', 'messageRawPayloadParser(%s) @ %s', rawPayload, this)

    // console.log(rawPayload)
    const payload = messageRawPayloadParser(rawPayload)
    return payload
  }

  public async messageSendText (
    conversationId : string,
    text           : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'messageSend(%s, %s)', conversationId, text)

    /**
     * 发送文本消息，可以包含emoji(😒)和QQ表情([坏笑])
     */
    await this.wechat4u.sendMsg(text, conversationId)
    /**
     * { BaseResponse: { Ret: 0, ErrMsg: '' },
     *  MsgID: '830582407297708303',
     *  LocalID: '15279119663740094' }
     */
  }

  public async messageSendFile (
    conversationId : string,
    file           : FileBox,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'messageSend(%s, %s)', conversationId, file)

    /**
     * 通过表情MD5发送表情
     */
    // wechat4u.sendMsg({
    //   emoticonMd5: '00c801cdf69127550d93ca52c3f853ff'
    // }, ToUserName)
    //   .catch(err => {
    //     bot.emit('error', err)
    //   })

    /**
     * 以下通过上传文件发送图片，视频，附件等
     * 通用方法为入下
     * file为多种类型
     * filename必填，主要为了判断文件类型
     */
    await this.wechat4u.sendMsg({
      file     : await file.toStream(),
      filename : file.name,
    }, conversationId)
  }

  public async messageSendContact (
    conversationId : string,
    contactId      : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'messageSend("%s", %s)', conversationId, contactId)
    throwUnsupportedError()
  }

  public async messageSendUrl (conversationId: string, urlLinkPayload: UrlLinkPayload) : Promise<void> {
    throwUnsupportedError(conversationId, urlLinkPayload)
  }

  public async messageSendMiniProgram (conversationId: string, miniProgramPayload: MiniProgramPayload): Promise<void> {
    log.verbose('PuppetWechat4u', 'messageSendMiniProgram("%s", %s)',
      JSON.stringify(conversationId),
      JSON.stringify(miniProgramPayload),
    )
    throwUnsupportedError(conversationId, miniProgramPayload)
  }

  public async messageForward (
    conversationid : string,
    messageId      : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'messageForward(%s, %s)',
      conversationid,
      messageId,
    )
    const rawPayload = await this.messageRawPayload(messageId)

    if (!rawPayload) {
      throw new Error('no rawPayload')
    }

    /**
     * 如何直接转发消息
     */
    await this.wechat4u.forwardMsg(rawPayload, conversationid)
  }

  /**
   *
   * Room Invitation
   *
   */
  public async roomInvitationAccept (roomInvitationId: string): Promise<void> {
    return throwUnsupportedError(roomInvitationId)
  }

  public async roomInvitationRawPayload (roomInvitationId: string): Promise<any> {
    return throwUnsupportedError(roomInvitationId)
  }

  public async roomInvitationRawPayloadParser (rawPayload: any): Promise<RoomInvitationPayload> {
    return throwUnsupportedError(rawPayload)
  }

  /**
   *
   * Room
   *
   */
  public async roomRawPayload (
    id: string,
  ): Promise<WebRoomRawPayload> {
    log.verbose('PuppetWechat4u', 'roomRawPayload(%s)', id)

    const rawPayload: WebRoomRawPayload = await retry<WebRoomRawPayload>((retryException, attempt) => {
      log.verbose('PuppetWechat4u', 'contactRawPayload(%s) retry() attempt=%d', id, attempt)

      if (!this.wechat4u.contacts[id]) {
        retryException(new Error('no this.wechat4u.contacts[' + id + ']'))
      }

      return this.wechat4u.contacts[id]
    })

    return rawPayload
  }

  public async roomRawPayloadParser (
    rawPayload: WebRoomRawPayload,
  ): Promise<RoomPayload> {
    log.verbose('PuppetWechat4u', 'roomRawPayloadParser(%s)', rawPayload)

    const id            = rawPayload.UserName
    // const rawMemberList = rawPayload.MemberList || []
    // const memberIdList  = rawMemberList.map(rawMember => rawMember.UserName)

    // const aliasDict = {} as { [id: string]: string | undefined }

    // if (Array.isArray(rawPayload.MemberList)) {
    //   rawPayload.MemberList.forEach(rawMember => {
    //     aliasDict[rawMember.UserName] = rawMember.DisplayName
    //   })
    // }

    const memberIdList = rawPayload.MemberList
      ? rawPayload.MemberList.map(m => m.UserName)
      : []

    const roomPayload: RoomPayload = {
      adminIdList: [],
      id,
      memberIdList,
      topic : rawPayload.NickName || '',
      // aliasDict,
    }
    return roomPayload
  }

  public async roomList (): Promise<string[]> {
    log.verbose('PuppetWechat4u', 'roomList()')

    const idList = this.wechat4u.contacts
      .filter((contact: any) => contact.isRoomContact())
      .map(
        (rawPayload: WebContactRawPayload) => rawPayload.UserName,
      )
    return idList
  }

  public async roomDel (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'roomDel(%s, %s)', roomId, contactId)

    const type = 'delmember'
    // XXX: [contactId] or [{ UserName: id }, ...] ?
    await this.wechat4u.updateChatroom(roomId, [contactId], type)
  }

  public async roomAvatar (roomId: string): Promise<FileBox> {
    log.verbose('PuppetWechat4u', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      // FIXME: set http headers with cookies
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetWechat4u', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  public async roomAdd (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'roomAdd(%s, %s)', roomId, contactId)

    const roomPayload = await this.roomPayload(roomId)

    // TODO: if the room owner enabled "invite only?"
    let type = 'addmember'  // invitemember ???
    if (roomPayload.memberIdList.length > 40) {
      type = 'invitemember'
    }

    // https://github.com/nodeWechat/wechat4u/tree/46931e78bcb56899b8d2a42a37b919e7feaebbef#botupdatechatroomchatroomusername-memberlist-fun
    const ret = await this.wechat4u.updateChatroom(roomId, [contactId], type)
    log.verbose('PuppetWechat4u', 'roomAdd(%s, %s) ret: %s', roomId, contactId, JSON.stringify(ret))
  }

  public async roomTopic (roomId: string)                : Promise<string>
  public async roomTopic (roomId: string, topic: string) : Promise<void>

  public async roomTopic (
    roomId: string,
    topic?: string,
  ): Promise<void | string> {
    log.verbose('PuppetWechat4u', 'roomTopic(%s, %s)', roomId, topic)

    const roomPayload = await this.roomPayload(roomId)

    if (typeof topic === 'undefined') {
      return roomPayload.topic
    }

    await this.wechat4u.updateChatRoomName(roomId, topic)
  }

  public async roomCreate (
    contactIdList : string[],
    topic         : string,
  ): Promise<string> {
    log.verbose('PuppetWechat4u', 'roomCreate(%s, %s)', contactIdList, topic)

    const memberList = contactIdList.map(id => ({ UserName: id }))

    const roomId = await this.wechat4u.createChatroom(topic, memberList)
    return roomId
  }

  public async roomAnnounce (roomId: string)                : Promise<string>
  public async roomAnnounce (roomId: string, text: string)  : Promise<void>

  public async roomAnnounce (roomId: string, text?: string) : Promise<void | string> {
    return throwUnsupportedError(roomId, text)
  }

  public async roomQuit (roomId: string): Promise<void> {
    return throwUnsupportedError(roomId)
  }

  public async roomQRCode (roomId: string): Promise<string> {
    return throwUnsupportedError(roomId)
  }

  public async roomMemberList (roomId: string) : Promise<string[]> {
    log.verbose('PuppetWechat4u', 'roommemberList(%s)', roomId)
    const rawPayload = await this.roomRawPayload(roomId)

    const memberIdList = (rawPayload.MemberList || [])
      .map(member => member.UserName)

    return memberIdList
  }

  public async roomMemberRawPayload (roomId: string, contactId: string): Promise<WebRoomRawMember>  {
    log.verbose('PuppetWechat4u', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    const rawPayload = await this.roomRawPayload(roomId)

    const memberPayloadList = rawPayload.MemberList || []

    const memberPayloadResult = memberPayloadList.filter(payload => payload.UserName === contactId)
    if (memberPayloadResult.length > 0) {
      return memberPayloadResult[0]
    } else {
      throw new Error('not found')
    }
  }

  public async roomMemberRawPayloadParser (rawPayload: WebRoomRawMember): Promise<RoomMemberPayload>  {
    log.verbose('PuppetWechat4u', 'roomMemberRawPayloadParser(%s)', rawPayload)

    const payload: RoomMemberPayload = {
      avatar    : rawPayload.HeadImgUrl,
      id        : rawPayload.UserName,
      name      : rawPayload.NickName,
      roomAlias : rawPayload.DisplayName,
    }
    return payload
  }

  /**
   *
   * Friendship
   *
   */
  public async friendshipSearchPhone (
    phone: string,
  ): Promise<null | string> {
    log.verbose('PuppetWechat4u', 'friendshipSearchPhone(%s)', phone)
    return throwUnsupportedError()
  }

  public async friendshipSearchWeixin (
    weixin: string,
  ): Promise<null | string> {
    log.verbose('PuppetWechat4u', 'friendshipSearchWeixin(%s)', weixin)
    return throwUnsupportedError()
  }

  public async friendshipAdd (
    contactId : string,
    hello     : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'friendshipAdd(%s, %s)', contactId, hello)

    await this.wechat4u.addFriend(contactId, hello)
  }

  public async friendshipAccept (
    friendshipId : string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'friendshipAccept(%s)', friendshipId)

    const payload = await this.friendshipPayload(friendshipId) as any as FriendshipPayloadReceive
    await this.wechat4u.verifyUser(payload.contactId, payload.ticket)
  }

  public async friendshipRawPayload (id: string): Promise<any> {
    log.verbose('PuppetWechat4u', 'friendshipRawPayload(%s)', id)

    const rawPayload = this.cacheMessageRawPayload.get(id)
    if (!rawPayload) {
      throw new Error('no rawPayload')
    }

    return rawPayload
  }

  public async friendshipRawPayloadParser (rawPayload: any) : Promise<FriendshipPayload> {
    log.verbose('PuppetWechat4u', 'friendshipRawPayloadParser(%s)', rawPayload)

    const timestamp = Math.floor(Date.now() / 1000) // in seconds

    switch (rawPayload.MsgType) {
      case WebMessageType.VERIFYMSG:
        if (!rawPayload.RecommendInfo) {
          throw new Error('no RecommendInfo')
        }
        const recommendInfo: WebRecomendInfo = rawPayload.RecommendInfo

        if (!recommendInfo) {
          throw new Error('no recommendInfo')
        }

        const payloadReceive: FriendshipPayloadReceive = {
          contactId : recommendInfo.UserName,
          hello     : recommendInfo.Content,
          id        : rawPayload.MsgId,
          ticket    : recommendInfo.Ticket,
          timestamp,
          type      : FriendshipType.Receive,
        }
        return payloadReceive

      case WebMessageType.SYS:
        const payloadConfirm: FriendshipPayloadConfirm = {
          contactId : rawPayload.FromUserName,
          id        : rawPayload.MsgId,
          timestamp,
          type      : FriendshipType.Confirm,
        }
        return payloadConfirm

      default:
        throw new Error('not supported friend request message raw payload')
    }
  }

  /**
   *
   * Tag
   *
   */
  public async tagContactAdd (
    tagId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'tagContactAdd(%s)', tagId, contactId)
  }

  public async tagContactRemove (
    tagId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'tagContactRemove(%s)', tagId, contactId)
  }

  public async tagContactDelete (
    tagId: string,
  ): Promise<void> {
    log.verbose('PuppetWechat4u', 'tagContactDelete(%s)', tagId)
  }

  public async tagContactList (
    contactId?: string,
  ): Promise<string[]> {
    log.verbose('PuppetWechat4u', 'tagContactList(%s)', contactId)
    return []
  }

}

export default PuppetWechat4u
