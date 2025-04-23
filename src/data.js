const { RateLimitedError } = require('./lib');

const { DateTime, Duration } = require('luxon');

const {
  GCP_API_KEY
} = process.env;

const getData = async (resource, params) => {
  try {
    const search = new URLSearchParams({
      key: GCP_API_KEY,
      ...params
    });
    const url = `https://www.googleapis.com/youtube/v3/${resource}?${search}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.log('failed to get data', response.status, await response.text());
      if (response.status === 429) {
        throw new RateLimitedError('429 in getData');
      }
      throw new Error(`failed to get data: ${response.status}, ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    console.log('failed to get data', error);
    throw error;
  }
};

// channel

const handleChannel = async (channelId, url) => {
  const filter = buildChannelFilter(channelId, url);
  if (!filter) {
    return {
      statusCode: 400
    };
  }

  const data = await getData('channels', {
    ...filter,
    part: 'id,snippet'
  });

  if (data.pageInfo.totalResults < 1) {
    return {
      statusCode: 404
    };
  }
  const response = data.items[0];

  return {
    statusCode: 200,
    body: JSON.stringify({
      visible: true,
      channelId: response.id,
      thumbnail: response.snippet.thumbnails.default.url,
      title: response.snippet.title
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

const buildChannelFilter = (channelId, url) => {
  if (channelId) {
    console.log('channelId', channelId);
    return { id: channelId };
  } else if (url) {
    console.log('url', url);
    const { pathname } = new URL(url);
    const matchId = /^\/channel\/(\w+)$/.exec(pathname);
    if (matchId) {
      return { id: matchId[1] };
    }
    const matchUsername = /^\/(c|user)\/([^\/]+)$/.exec(pathname);
    if (matchUsername) {
      return { forUsername: matchUsername[2] };
    }
    const matchHandle = /^\/@([^\/]+)$/.exec(pathname);
    if (matchHandle) {
      return { forHandle: matchHandle[1] };
    }
  } else {
    console.log('missing channelId or url');
  }
}

// video

const handleVideo = async (videoId, url) => {
  const filter = buildVideoFilter(videoId, url);
  if (!filter) {
    return {
      statusCode: 400
    };
  }

  const data = await getData('videos', {
    ...filter,
    part: 'id,snippet,contentDetails,liveStreamingDetails'
  });

  if (data.pageInfo.totalResults < 1) {
    return {
      statusCode: 404
    };
  }
  const response = data.items[0];

  return {
    statusCode: 200,
    body: JSON.stringify({
      visible: true,
      channelId: response.snippet.channelId,
      duration: convertDuration(response.contentDetails.duration),
      isLive: response.snippet.liveBroadcastContent === 'live',
      isLiveContent: false, // TODO
      isUpcoming: response.snippet.liveBroadcastContent === 'upcoming',
      publishedDate: response.snippet.publishedAt,
      scheduledAt: convertScheduledAt(response.liveStreamingDetails?.scheduledStartTime),
      title: response.snippet.title,
      videoId: response.id
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

const buildVideoFilter = (videoId, url) => {
  if (videoId) {
    console.log('videoId', videoId);
    return { id: videoId };
  } else if (url) {
    console.log('url', url);
    const { hostname, pathname, searchParams } = new URL(url);
    if (hostname === 'youtu.be') {
      return { id: pathname.substring(1) };
    } else if (pathname === '/watch') {
      return { id: searchParams.get('v') };
    } else {
      console.log('invalid url');
    }
  } else {
    console.log('missing videoId or url');
  }
};

const convertDuration = (duration) => duration ? Duration.fromISO(duration).as('seconds') : 0;

const convertScheduledAt = (scheduledAt) => scheduledAt ? DateTime.fromISO(scheduledAt).toSeconds() : null;

module.exports = {
  handleChannel,
  handleVideo
}
