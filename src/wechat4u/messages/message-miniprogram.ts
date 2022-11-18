import type * as PUPPET from 'wechaty-puppet'
import type { WebMessageRawPayload } from '../../web-schemas.js'
import { xmlToJson } from '../utils/xml-to-json.js'

interface MiniProgramXmlSchema {
  msg: {
    appmsg: {
      title: string;
      sourcedisplayname: string;
      url: string;
      appattach: {
        cdnthumbaeskey: string;
        cdnthumburl: string;
      };
      weappinfo: {
        username: string;
        appid: string;
        pagepath: string;
        weappiconurl: string;
        shareId: string;
      };
      thumburl: string;
      md5: any;
    };
    fromusername: string;
  };
}

export async function parseMiniProgramMessagePayload (rawPayload: WebMessageRawPayload): Promise<PUPPET.payloads.MiniProgram> {
  const miniProgramXml: MiniProgramXmlSchema = await xmlToJson(rawPayload.Content)
  const appmsg = miniProgramXml.msg.appmsg
  const weappinfo = appmsg.weappinfo
  const appattach = appmsg.appattach

  return {
    appid: weappinfo.appid,
    description: appmsg.sourcedisplayname,
    iconUrl: weappinfo.weappiconurl,
    pagePath: weappinfo.pagepath,
    shareId: weappinfo.shareId,
    thumbKey: appattach.cdnthumbaeskey,
    thumbUrl: appattach.cdnthumburl,
    title: appmsg.title,
    username: weappinfo.username,
  }
}
