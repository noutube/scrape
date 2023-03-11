const axios = require('axios');

module.exports.scrapeChannel = async (event, context) => {
  const { url } = event.queryStringParameters;
}

// channel

const getChannelId = (channelId, url) => {
  if (channelId) {
    console.log('channelId', channelId);
    return channelId;
  } else if (url) {
    console.log('url', url);
    const { hostname, pathname } = new URL(url);
    if (hostname !== 'www.twitch.tv' && hostname !== 'twitch.tv') {
      console.log('invalid domain');
    } else if (!/^\/[A-Za-z0-9_]+$/.test(pathname)) {
      console.log('invalid path');
      return pathname;
    } else {
    }
  } else {
    console.log('missing channelId or url');
  }
};
