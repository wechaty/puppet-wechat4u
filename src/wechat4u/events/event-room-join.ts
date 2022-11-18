import type { WebMessageRawPayload } from '../../web-schemas.js'

import type * as PUPPET from 'wechaty-puppet'
import { isRoomId } from '../utils/is-type.js'
import type { EventPayload } from './event.js'
import { removeRoomLeaveDebounce } from './event-room-leave.js'
import { executeRunners } from '../utils/runner.js'
import { WebMessageType } from '../../web-schemas.js'

const YOU_INVITE_OTHER_REGEX_LIST = [
  /^你邀请"(.+)"加入了群聊 {2}/,
  /^You invited (.+) to the group chat/,
]
const OTHER_INVITE_YOU_REGEX_LIST = [
  /^"([^"]+?)"邀请你加入了群聊，群聊参与人还有：(.+)/,
  /^(.+) invited you to a group chat with (.+)/,
]
const OTHER_INVITE_YOU_AND_OTHER_REGEX_LIST = [
  /^"([^"]+?)"邀请你和"(.+?)"加入了群聊/,
  /^(.+?) invited you and (.+?) to (the|a) group chat/,
]
const OTHER_INVITE_OTHER_REGEX_LIST = [
  /^"(.+)"邀请"(.+)"加入了群聊/,
  /^(.+?) invited (.+?) to (the|a) group chat/,
]
const OTHER_JOIN_VIA_YOUR_QRCODE_REGEX_LIST = [
  /^" ?(.+)"通过扫描你分享的二维码加入群聊/,
  /^" ?(.+)" joined group chat via the QR code you shared/,
]
const OTHER_JOIN_VIA_OTHER_QRCODE_REGEX_LIST = [
  /^" (.+)"通过扫描"(.+)"分享的二维码加入群聊/,
  /^"(.+)" joined the group chat via the QR Code shared by "(.+)"/,
]

export default async (puppet: PUPPET.Puppet, message: WebMessageRawPayload): Promise<EventPayload> => {
  const roomId = message.FromUserName
  if (!isRoomId(roomId)) {
    return null
  }

  const timestamp = message.CreateTime

  if (![WebMessageType.SYS].includes(message.MsgType)) {
    return null
  }

  /**
   * 1. You Invite Other to join the Room
   * (including other join var qr code you shared)
   * /^你邀请"(.+)"加入了群聊 {2}\$revoke\$/,
   * /^" ?(.+)"通过扫描你分享的二维码加入群聊/,
   */
  const youInviteOther = async () => {
    let matches: null | string[] = null;
    [...YOU_INVITE_OTHER_REGEX_LIST, ...OTHER_JOIN_VIA_YOUR_QRCODE_REGEX_LIST].some((re) => !!(matches = message.Content.match(re)))
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (matches) {
      const inviteName = matches[1]!
      const inviteeId = (await puppet.roomMemberSearch(roomId, inviteName))[0]!

      return {
        inviteeIdList: [inviteeId],
        inviterId: puppet.currentUserId,
        roomId,
        timestamp,
      } as PUPPET.payloads.EventRoomJoin
    }
    return null
  }

  /**
   * 2. Other Invite you to join the Room
   * /^"([^"]+?)"邀请你加入了群聊/,
   */
  const otherInviteYou = async () => {
    let matches: null | string[] = null
    OTHER_INVITE_YOU_REGEX_LIST.some((re) => !!(matches = message.Content.match(re)))
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (matches) {
      const inviteName = matches[1]!
      const inviterId = (await puppet.roomMemberSearch(roomId, inviteName))[0]!

      return {
        inviteeIdList: [puppet.currentUserId],
        inviterId,
        roomId,
        timestamp,
      } as PUPPET.payloads.EventRoomJoin
    }
    return null
  }

  /**
   * 3. Other invite you and others to join the room
   * /^"([^"]+?)"邀请你和"(.+?)"加入了群聊/,
   * /^"(.+)"邀请"(.+)"加入了群聊/,
   */
  const otherInviteOther = async () => {
    let matches: null | string[] = null;
    [...OTHER_INVITE_YOU_AND_OTHER_REGEX_LIST, ...OTHER_INVITE_OTHER_REGEX_LIST].some((re) => !!(matches = message.Content.match(re)))
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (matches) {
      const inviteeIdList = []
      const inviterName = matches[1]
      const inviterId = (await puppet.roomMemberSearch(roomId, inviterName))[0]
      const inviteeName = matches[2]
      const inviteeId = (await puppet.roomMemberSearch(roomId, inviteeName))[0]
      // 如果包含ni则把机器人的id放进去
      if (message.Content.includes('你')) {
        inviteeIdList.push(puppet.currentUserId)
      }
      inviteeIdList.push(inviteeId)
      return {
        inviteeIdList,
        inviterId,
        roomId,
        timestamp,
      } as PUPPET.payloads.EventRoomJoin
    }
    return null
  }

  /**
   * 4. Other Invite Other via Qrcode to join a Room
   * /^" (.+)"通过扫描"(.+)"分享的二维码加入群聊/,
   */
  const otherJoinViaQrCode = async () => {
    let matches: null | string[] = null
    OTHER_JOIN_VIA_OTHER_QRCODE_REGEX_LIST.some((re) => !!(matches = message.Content.match(re)))
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (matches) {
      const inviteeIdList = []

      const inviteeName = matches[1]!
      const inviteeId = (await puppet.roomMemberSearch(roomId, inviteeName))[0]!
      inviteeIdList.push(inviteeId)

      const inviterName = matches[2]
      const inviterId = (await puppet.roomMemberSearch(roomId, inviterName))[0]!
      return {
        inviteeIdList,
        inviterId,
        roomId,
        timestamp,
      } as PUPPET.payloads.EventRoomJoin
    }
    return null
  }

  const ret = await executeRunners([youInviteOther, otherInviteYou, otherInviteOther, otherJoinViaQrCode])
  if (ret) {
    ret.inviteeIdList.forEach((inviteeId) => {
      removeRoomLeaveDebounce(ret!.roomId, inviteeId)
    })
  }
  return ret
}
