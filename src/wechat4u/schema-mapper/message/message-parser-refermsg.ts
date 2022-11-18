import * as PUPPET from 'wechaty-puppet'
import { AppMessageType, parseAppmsgMessagePayload, ReferMsgPayload } from '../../messages/message-appmsg.js'
import type { MessageParser, MessageParserContext } from './message-parser.js'
import { WebMessageRawPayload, WebMessageType } from '../../../web-schemas.js'

export const referMsgParser: MessageParser = async (_webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message, context: MessageParserContext) => {
  if (!context.appMessagePayload || context.appMessagePayload.type !== AppMessageType.ReferMsg) {
    return ret
  }

  const appPayload = context.appMessagePayload

  let referMessageContent: string

  const referMessagePayload: ReferMsgPayload = appPayload.refermsg!
  const referMessageType = parseInt(referMessagePayload.type) as WebMessageType
  switch (referMessageType) {
    case WebMessageType.TEXT:
      referMessageContent = referMessagePayload.content
      break
    case WebMessageType.IMAGE:
      referMessageContent = '图片'
      break

    case WebMessageType.VIDEO:
      referMessageContent = '视频'
      break

    case WebMessageType.EMOTICON:
      referMessageContent = '动画表情'
      break

    case WebMessageType.LOCATION:
      referMessageContent = '位置'
      break

    case WebMessageType.APP: {
      const referMessageAppPayload = await parseAppmsgMessagePayload(referMessagePayload.content)
      referMessageContent = referMessageAppPayload.title
      break
    }

    default:
      referMessageContent = '未知消息'
      break
  }

  ret.type = PUPPET.types.Message.Text
  ret.text = `「${referMessagePayload.displayname}：${referMessageContent}」\n- - - - - - - - - - - - - - -\n${appPayload.title}`

  return ret
}
