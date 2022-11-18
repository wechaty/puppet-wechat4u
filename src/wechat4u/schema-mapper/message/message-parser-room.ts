import type * as PUPPET from 'wechaty-puppet'
import { isRoomId, isContactId } from '../../utils/is-type.js'
import type { MessageParser, MessageParserContext } from './message-parser.js'
import type { WebMessageRawPayload } from '../../../web-schemas'
import { parseMentionIdList } from '../../utils/parse-mention-id-list.js'

async function roomMessageSentByOthers (webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message) {
  let roomId: string | undefined
  if (isRoomId(webMessageRawPayload.FromUserName)) {
    roomId = webMessageRawPayload.FromUserName
  } else if (isRoomId(webMessageRawPayload.ToUserName)) {
    roomId = webMessageRawPayload.ToUserName
  } else {
    roomId = undefined
  }

  if (roomId) {
    ret.roomId = roomId

    /**
     * separator of talkerId and content:
     *
     * text:    "wxid_xxxx:\nnihao"
     * appmsg:  "wxid_xxxx:\n<?xml version="1.0"?><msg><appmsg appid="" sdkver="0">..."
     * pat:     "19850419xxx@chatroom:\n<sysmsg type="pat"><pat><fromusername>xxx</fromusername><chatusername>19850419xxx@chatroom</chatusername><pattedusername>wxid_xxx</pattedusername>...<template><![CDATA["${vagase}" 拍了拍我]]></template></pat></sysmsg>"
     */
    const separatorIndex = webMessageRawPayload.OriginalContent.indexOf(':<br/>')

    if (separatorIndex !== -1) {
      const takerIdPrefix = webMessageRawPayload.OriginalContent.slice(0, separatorIndex)
      ret.talkerId = takerIdPrefix
      let text: string|undefined = ''
      const parts = webMessageRawPayload.Content.split(':\n')
      if (parts.length > 1) {
        text = parts[1]
      } else {
        text = webMessageRawPayload.Content
      }
      ret.text = text
    } else {
      /**
       * Message that can not get talkerId from payload:
       * 1. Create room with users that have deleted you: https://gist.github.com/padlocal/e95f8e05eb00556317991964eecfd150
       *
       * But talkerId is required by Wechaty, or exception will be raised:
       * https://github.com/wechaty/wechaty/blob/435cefd90baf7f2a0c801010132e74f9e0575fc2/src/user-modules/message.ts#L813
       * Solution: we set talkerId to fromusername, treating these kinds of messages are sent by self.
       */
      ret.talkerId = webMessageRawPayload.ToUserName
    }
  }
}

async function roomMessageSentBySelf (webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message) {
  let talkerId: string | undefined
  let roomId: string | undefined

  if (isRoomId(webMessageRawPayload.FromUserName)) {
    roomId = webMessageRawPayload.FromUserName
  } else if (isRoomId(webMessageRawPayload.ToUserName)) {
    roomId = webMessageRawPayload.ToUserName
  } else {
    roomId = undefined
  }

  if (isContactId(webMessageRawPayload.FromUserName)) {
    talkerId = webMessageRawPayload.FromUserName
  } else {
    const array: string[] = webMessageRawPayload.OriginalContent.match(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/) || []

    talkerId = array[1]
    if (!talkerId) {
      talkerId = ''
    }
  }

  if (roomId) {
    // room message sent by self
    ret.roomId = roomId
    ret.talkerId = talkerId

    let text: string|undefined = ''
    const parts = webMessageRawPayload.Content.split(':\n')
    if (parts.length > 1) {
      text = parts[1]
    } else {
      text = webMessageRawPayload.Content
    }
    ret.text = text
  }
}

/**
 * try to parse talkerId and content for generic room messages
 * @param padLocalMessage
 * @param ret
 * @param context
 */
export const roomParser: MessageParser = async (webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message, context: MessageParserContext) => {
  await roomMessageSentByOthers(webMessageRawPayload, ret)
  await roomMessageSentBySelf(webMessageRawPayload, ret)

  if (ret.roomId) {
    context.isRoomMessage = true

    const mentionIdList: string[] = await parseMentionIdList(context.puppet, ret.roomId, ret.text || '')
    const room = ret as PUPPET.payloads.MessageRoom
    room.mentionIdList = mentionIdList
  }

  return ret
}
