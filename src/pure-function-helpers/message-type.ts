import * as PUPPET from 'wechaty-puppet'

import {
  WebMessageRawPayload,
  WebMessageType,
}                     from '../web-schemas.js'

export function messageType (
  rawPayload: WebMessageRawPayload,
): PUPPET.type.Message {
  switch (rawPayload.MsgType) {
    case WebMessageType.TEXT:
      return PUPPET.type.Message.Text

    case WebMessageType.EMOTICON:
    case WebMessageType.IMAGE:
      return PUPPET.type.Message.Image

    case WebMessageType.VOICE:
      return PUPPET.type.Message.Audio

    case WebMessageType.MICROVIDEO:
    case WebMessageType.VIDEO:
      return PUPPET.type.Message.Video

    /**
     * Treat those Types as TEXT
     *
     * FriendRequest is a SYS message
     * FIXME: should we use better message type at here???
     */
    case WebMessageType.SYS:
    case WebMessageType.APP:
      return PUPPET.type.Message.Text

    // VERIFYMSG           = 37,
    // POSSIBLEFRIEND_MSG  = 40,
    // SHARECARD           = 42,
    // LOCATION            = 48,
    // VOIPMSG             = 50,
    // STATUSNOTIFY        = 51,
    // VOIPNOTIFY          = 52,
    // VOIPINVITE          = 53,
    // SYSNOTICE           = 9999,
    // RECALLED            = 10002,
    default:
      return PUPPET.type.Message.Text
  }
}
