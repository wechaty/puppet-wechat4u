import type * as PUPPET from 'wechaty-puppet'
import type { MessageParser, MessageParserContext } from './message-parser'
import type { WebMessageRawPayload } from '../../../web-schemas'

export const singleChatParser: MessageParser = async (webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message, context: MessageParserContext) => {
  if (!context.isRoomMessage) {
    ret.talkerId = webMessageRawPayload.FromUserName
    ret.listenerId = webMessageRawPayload.ToUserName
  }

  return ret
}
