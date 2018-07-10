# WECHATY-PUPPET-WECHAT4U

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-blue.svg)](https://github.com/chatie/wechaty)
[![NPM Version](https://badge.fury.io/js/wechaty-puppet-wechat4u.svg)](https://badge.fury.io/js/wechaty-puppet-wechat4u)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Linux/Mac Build Status](https://travis-ci.com/Chatie/wechaty-puppet-wechat4u.svg?branch=master)](https://travis-ci.com/Chatie/wechaty-puppet-wechat4u) [![Greenkeeper badge](https://badges.greenkeeper.io/Chatie/wechaty-puppet-wechat4u.svg)](https://greenkeeper.io/)

![wechaty puppet wechat4u](https://chatie.io/wechaty-puppet-wechat4u/images/wechat4u-logo.png)

Wechat4u Puppet for Wechaty

See: [New Puppet - Plan to support `WECHATY_HEAD=WECHAT4U` #69](https://github.com/Chatie/wechaty/issues/69)

## ABOUT WECHAT4U

[Wechat4U](https://github.com/nodeWechat/wechat4u) is an excellent wechat bot framework that supports both Node.js & Browser, with rich features and an active community of experienced contributors.

## KNOWN LIMITATIONS

1. WeChat Account that registered after 2017 mignt not be able to login Web Wechat, so it can not use PuppetPuppeteer with Wechaty. Please make sure your WeChat Account can be able to login by visiting <https://wx.qq.com>
1. Web API can not create room and invite members to room since 2018.

If you want to break the above limitations, please consider to use a Wechaty Puppet other than using Web API, like [wechaty-puppet-padchat](https://github.com/lijiarui/wechaty-puppet-padchat).

Learn more about the Puppet at [Wechaty wiki: Puppet](https://github.com/Chatie/wechaty/wiki/Puppet)

## AUTHOR

[Huan LI](http://linkedin.com/in/zixia) \<zixia@zixia.net\>

<a href="https://stackexchange.com/users/265499">
  <img src="https://stackexchange.com/users/flair/265499.png" width="208" height="58" alt="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites">
</a>

## COPYRIGHT & LICENSE

* Code & Docs © 2018 Huan LI \<zixia@zixia.net\>
* Code released under the Apache-2.0 License
* Docs released under Creative Commons
