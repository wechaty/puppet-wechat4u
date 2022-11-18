import type * as PUPPET from 'wechaty-puppet'
import type { AppMessagePayload } from '../../messages/message-appmsg.js'
import type { WebMessageRawPayload } from '../../../web-schemas.js'

/**
 * Add customized message parser context info here
 */
export type MessageParserContext = {
  puppet: PUPPET.Puppet,
  isRoomMessage: boolean,
  appMessagePayload?: AppMessagePayload,
};

export type MessageParser = (webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message, context: MessageParserContext) => Promise<PUPPET.payloads.Message>;

const messageParserList: Array<MessageParser> = []

export function addMessageParser (parser: MessageParser) {
  messageParserList.push(parser)
}

export async function executeMessageParsers (puppet: PUPPET.Puppet, webMessageRawPayload: WebMessageRawPayload, ret: PUPPET.payloads.Message): Promise<PUPPET.payloads.Message> {
  const context: MessageParserContext = {
    isRoomMessage: false,
    puppet,
  }

  for (const parser of messageParserList) {
    ret = await parser(webMessageRawPayload, ret, context)
  }

  return ret
}

export const LOGPRE = 'message-parser'
