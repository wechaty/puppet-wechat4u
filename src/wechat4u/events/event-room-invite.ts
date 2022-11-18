import { parseAppmsgMessagePayload, AppMessagePayload, AppMessageType } from '../messages/message-appmsg.js'
import type * as PUPPET from 'wechaty-puppet'
import type { WebMessageRawPayload } from '../../web-schemas.js'
import { isRoomId } from '../utils/is-type.js'
import type { EventPayload } from './event.js'

const ROOM_OTHER_INVITE_TITLE_ZH = [/邀请你加入群聊/]
const ROOM_OTHER_INVITE_TITLE_EN = [/Group Chat Invitation/]
const ROOM_OTHER_INVITE_LIST_ZH = [/^"(.+)"邀请你加入群聊(.*)，进入可查看详情。/]
const ROOM_OTHER_INVITE_LIST_EN = [/"(.+)" invited you to join the group chat "(.+)"\. Enter to view details\./]

export default async (_puppet: PUPPET.Puppet, message: WebMessageRawPayload): Promise<EventPayload> => {
  let appMsgPayload: AppMessagePayload
  try {
    appMsgPayload = await parseAppmsgMessagePayload(message.Content)
  } catch (e) {
    return null
  }

  if (appMsgPayload.type !== AppMessageType.Url) {
    return null
  }

  if (!appMsgPayload.title || !appMsgPayload.des) {
    return null
  }

  let matchesForOtherInviteTitleEn = null as null | string[]
  let matchesForOtherInviteTitleZh = null as null | string[]
  let matchesForOtherInviteEn = null as null | string[]
  let matchesForOtherInviteZh = null as null | string[]

  ROOM_OTHER_INVITE_TITLE_EN.some((regex) => !!(matchesForOtherInviteTitleEn = appMsgPayload.title.match(regex)))
  ROOM_OTHER_INVITE_TITLE_ZH.some((regex) => !!(matchesForOtherInviteTitleZh = appMsgPayload.title.match(regex)))
  ROOM_OTHER_INVITE_LIST_EN.some((regex) => !!(matchesForOtherInviteEn = appMsgPayload.des!.match(regex)))
  ROOM_OTHER_INVITE_LIST_ZH.some((regex) => !!(matchesForOtherInviteZh = appMsgPayload.des!.match(regex)))

  const titleMatch = matchesForOtherInviteTitleEn || matchesForOtherInviteTitleZh
  const matchInviteEvent = matchesForOtherInviteEn || matchesForOtherInviteZh
  const matches = !!titleMatch && !!matchInviteEvent

  if (!matches) {
    return null
  }

  let receiverId = ''
  // 如果不是群，则接收人是机器人 是群的话，接收人为群
  if (!isRoomId(message.FromUserName)) {
    receiverId = _puppet.currentUserId
  } else {
    receiverId = message.FromUserName
  }

  return {
    avatar: appMsgPayload.thumburl,
    id: message.MsgId,
    invitation: appMsgPayload.url,
    inviterId: message.FromUserName,
    memberCount: 0,
    memberIdList: [],
    receiverId,
    timestamp: message.CreateTime,
    topic: matchInviteEvent![2],
  } as PUPPET.payloads.RoomInvitation
}
