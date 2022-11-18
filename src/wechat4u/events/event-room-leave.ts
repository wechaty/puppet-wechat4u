import { WebMessageRawPayload, WebMessageType } from '../../web-schemas.js'

import type * as PUPPET from 'wechaty-puppet'
import { isRoomId } from '../utils/is-type.js'
import type { EventPayload } from './event.js'
import { executeRunners } from '../utils/runner.js'

const YOU_REMOVE_OTHER_REGEX_LIST = [
  /^(你)将"(.+)"移出了群聊/,
  /^(You) removed "(.+)" from the group chat/,
]
const OTHER_REMOVE_YOU_REGEX_LIST = [
  /^(你)被"([^"]+?)"移出群聊/,
  /^(You) were removed from the group chat by "([^"]+)"/,
]

const roomLeaveDebounceMap: Map<string, ReturnType<typeof setTimeout>> = new Map()
const DEBOUNCE_TIMEOUT = 3600 * 1000 // 1 hour

function roomLeaveDebounceKey (roomId: string, removeeId: string) {
  return `${roomId}:${removeeId}`
}

function roomLeaveAddDebounce (roomId: string, removeeId: string) {
  const key = roomLeaveDebounceKey(roomId, removeeId)
  const oldTimeout = roomLeaveDebounceMap.get(key)
  if (oldTimeout) {
    clearTimeout(oldTimeout)
  }

  const timeout = setTimeout(() => {
    roomLeaveDebounceMap.delete(key)
  }, DEBOUNCE_TIMEOUT)
  roomLeaveDebounceMap.set(key, timeout)
}

// to fix: https://github.com/padlocal/wechaty-puppet-padlocal/issues/43
export function removeRoomLeaveDebounce (roomId: string, removeeId: string) {
  const key = roomLeaveDebounceKey(roomId, removeeId)
  roomLeaveDebounceMap.delete(key)
}

export function isRoomLeaveDebouncing (roomId: string, removeeId: string): boolean {
  const key = roomLeaveDebounceKey(roomId, removeeId)
  return roomLeaveDebounceMap.get(key) !== undefined
}

export default async (puppet: PUPPET.Puppet, message: WebMessageRawPayload): Promise<EventPayload> => {
  const roomId = message.FromUserName
  if (!isRoomId(roomId) || ![WebMessageType.SYS].includes(message.MsgType)) {
    return null
  }

  /**
   * 1. 我将别人移除
   * /^(你)将"(.+)"移出了群聊/,
   *  我移除别人是 10002: https://gist.github.com/padlocal/5676b96ad0ca918fdd53849417eff422
   */
  const youRemoveOther = async () => {
    let matches: null | string[] = null
    YOU_REMOVE_OTHER_REGEX_LIST.some((re) => !!(matches = message.Content.match(re)))
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (matches) {
      const removerName = matches[2]!
      const removerId = (await puppet.roomMemberSearch(roomId, removerName))[0]!

      return {
        removeeIdList: [removerId],
        removerId: puppet.currentUserId,
        roomId,
        timestamp: message.CreateTime,
      } as PUPPET.payloads.EventRoomLeave
    }
    return null
  }

  /**
   * 2. 别人移除我
   * /^(你)被"([^"]+?)"移出群聊/,
   * // 我被别人移除是 10000：https://gist.github.com/padlocal/60be89334d4d743937f07023da20291e
   */
  const otherRemoveYou = async () => {
    let matches: null | string[] = null
    OTHER_REMOVE_YOU_REGEX_LIST.some((re) => !!(matches = message.Content.match(re)))
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (matches) {
      const removerName = matches[2]!
      const removerId = (await puppet.roomMemberSearch(roomId, removerName))[0]!

      return {
        removeeIdList: [puppet.currentUserId],
        removerId,
        roomId,
        timestamp: message.CreateTime,
      } as PUPPET.payloads.EventRoomLeave
    }

    return null
  }

  const ret = await executeRunners<PUPPET.payloads.EventRoomLeave>([youRemoveOther, otherRemoveYou])
  if (ret) {
    ret.removeeIdList.forEach((leaverId) => {
      roomLeaveAddDebounce(roomId, leaverId)
    })
  }
  return ret
}
