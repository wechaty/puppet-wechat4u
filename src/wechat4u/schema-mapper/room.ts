import type { WebRoomRawPayload, WebRoomRawMember } from '../../web-schemas.js'

import type * as PUPPET from 'wechaty-puppet'
import { log } from 'wechaty-puppet'

export function wechat4uRoomToWechaty (rawPayload: WebRoomRawPayload): PUPPET.payloads.Room {
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

  const roomPayload: PUPPET.payloads.Room = {
    adminIdList: [],
    avatar: rawPayload.HeadImgUrl,
    id,
    memberIdList,
    topic : rawPayload.NickName || '',
    // aliasDict,
  }
  return roomPayload
}

export function wechat4uRoomMemberToWechaty (rawPayload: WebRoomRawMember): PUPPET.payloads.RoomMember {
  log.verbose('PuppetWechat4u', 'roomMemberRawPayloadParser(%s)', rawPayload)

  const payload: PUPPET.payloads.RoomMember = {
    avatar    : rawPayload.HeadImgUrl,
    id        : rawPayload.UserName,
    name      : rawPayload.NickName,
    roomAlias : rawPayload.DisplayName,
  }
  return payload
}
