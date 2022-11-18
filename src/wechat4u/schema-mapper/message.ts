import type { WebMessageRawPayload } from '../../web-schemas.js'
import * as PUPPET from 'wechaty-puppet'
import { executeMessageParsers } from './message/mod.js'
import { isContactId, isRoomId } from '../utils/is-type.js'

export async function webMessageToWechaty (puppet: PUPPET.Puppet, webMessageRawPayload: WebMessageRawPayload): Promise<PUPPET.payloads.Message> {
  let talkerId: undefined | string
  let text: undefined | string
  /**
   * 1. Set From Contact Id
   */
  if (isContactId(webMessageRawPayload.FromUserName)) {

    talkerId = webMessageRawPayload.FromUserName

  } else {

    const array: string[] = webMessageRawPayload.OriginalContent.match(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/) || []

    talkerId = array[1]
    if (!talkerId) {
      talkerId = undefined
    }
  }
  /**
   *
   * 2. Set Text
   */
  if (isRoomId(webMessageRawPayload.FromUserName)) {

    const parts = webMessageRawPayload.Content.split(':\n')
    if (parts.length > 1) {

      text = parts[1]

    } else {

      text = webMessageRawPayload.Content

    }

  } else {

    text = webMessageRawPayload.Content

  }
  // set default value for MessagePayloadBase, other fields will be fulfilled or updated var MessageParers
  const ret: PUPPET.payloads.Message = {
    id: webMessageRawPayload.MsgId,
    talkerId,
    text,
    timestamp: webMessageRawPayload.CreateTime,
    type: PUPPET.types.Message.Unknown,
  } as PUPPET.payloads.Message

  await executeMessageParsers(puppet, webMessageRawPayload, ret)
  // validate the return value
  if (!(ret.roomId || ret.listenerId)) {
    throw new Error('neither roomId nor listenerId')
  }

  return ret
}
