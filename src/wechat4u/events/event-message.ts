import type * as PUPPET from 'wechaty-puppet'
import type { WebMessageRawPayload } from '../../web-schemas.js'
import type { EventPayload } from './event.js'

export default async (_puppet: PUPPET.Puppet, message: WebMessageRawPayload): Promise<EventPayload> => {
  return message
}
