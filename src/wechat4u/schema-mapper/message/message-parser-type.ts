import * as PUPPET from 'wechaty-puppet'
import { log } from 'wechaty-puppet'
import type { MessageParser, MessageParserContext } from './message-parser.js'
import { LOGPRE } from './message-parser.js'
import { WebMessageRawPayload, WebMessageType } from '../../../web-schemas.js'

const TypeMappings: { [key: number]: PUPPET.types.Message; } = {
  [WebMessageType.TEXT]: PUPPET.types.Message.Text,
  [WebMessageType.IMAGE]: PUPPET.types.Message.Image,
  [WebMessageType.VOICE]: PUPPET.types.Message.Audio,
  [WebMessageType.EMOTICON]: PUPPET.types.Message.Emoticon,
  [WebMessageType.APP]: PUPPET.types.Message.Attachment,
  [WebMessageType.LOCATION]: PUPPET.types.Message.Location,
  [WebMessageType.MICROVIDEO]: PUPPET.types.Message.Video,
  [WebMessageType.VIDEO]: PUPPET.types.Message.Video,
  [WebMessageType.SYS]: PUPPET.types.Message.Unknown,
  [WebMessageType.SHARECARD]: PUPPET.types.Message.Contact,
  [WebMessageType.RECALLED]: PUPPET.types.Message.Recalled,
  [WebMessageType.STATUSNOTIFY]: PUPPET.types.Message.Unknown,
  [WebMessageType.SYSNOTICE]: PUPPET.types.Message.Unknown,
}

export const typeParser: MessageParser = async (webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message, _context: MessageParserContext) => {
  const wechatMessageType = webMessageRawPayload.MsgType as WebMessageType

  let type: PUPPET.types.Message | undefined = TypeMappings[wechatMessageType]

  if (!type) {
    log.verbose(LOGPRE, `unsupported type: ${JSON.stringify(webMessageRawPayload)}`)

    type = PUPPET.types.Message.Unknown
  }

  ret.type = type

  return ret
}
