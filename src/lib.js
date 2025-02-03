class RateLimitedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

const getData = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20200214.04.00'
      }
    });
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
  const path = buildChannelPath(channelId, url);
  if (!path) {
    return {
      statusCode: 400
    };
  }

  const data = await getData(`https://www.youtube.com${path}?pbj=1`);
  const response = getChannelResponse(data);

  if (response.alerts) {
    const alerts = response.alerts.map((alert) => alert.alertRenderer.text.simpleText);
    console.log('channel has alerts', alerts, JSON.stringify(response.alerts, null, 2));
    if (alerts.includes('This channel was removed because it violated our Community Guidelines.')) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          visible: false,
          reason: 'banned'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 403
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      visible: true,
      ...getChannel(response)
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

const buildChannelPath = (channelId, url) => {
  if (channelId) {
    console.log('channelId', channelId);
    return `/channel/${channelId}`;
  } else if (url) {
    console.log('url', url);
    const { pathname } = new URL(url);
    if (/^\/(user\/|channel\/|c\/|@|)[A-Za-z0-9_-]+$/.test(pathname) && pathname !== '/watch') {
      return pathname;
    } else {
      console.log('invalid url');
    }
  } else {
    console.log('missing channelId or url');
  }
};

const getChannel = (response) => {
  const channelId = getChannelChannelId(response);
  console.log('channelId', channelId);
  const thumbnail = getChannelThumbnail(response);
  console.log('thumbnail', thumbnail);
  const title = getChannelTitle(response);
  console.log('title', title);

  return { channelId, thumbnail, title };
};

const getChannelResponse = (data) => {
  try {
    // YouTube randomly picks different response formats
    return data.response ?? data[1].response;
  } catch (error) {
    console.log('failed to get channel response', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getChannelChannelId = (response) => {
  try {
    return response.header.c4TabbedHeaderRenderer?.channelId ?? response.metadata.channelMetadataRenderer.externalId;
  } catch (error) {
    console.log('failed to get channel channelId', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getChannelThumbnail = (response) => {
  try {
    return response.header.c4TabbedHeaderRenderer?.avatar?.thumbnails?.[1]?.url ?? response.metadata.channelMetadataRenderer.avatar.thumbnails[0].url;
  } catch (error) {
    console.log('failed to get channel thumbnail', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getChannelTitle = (response) => {
  try {
    return response.header.c4TabbedHeaderRenderer?.title ?? response.metadata.channelMetadataRenderer.title;
  } catch (error) {
    console.log('failed to get channel title', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

// video

const handleVideo = async (videoId, url) => {
  const path = buildVideoPath(videoId, url);
  if (!path) {
    return {
      statusCode: 400
    };
  }

  const data = await getData(`https://www.youtube.com${path}&pbj=1`);
  const response = getVideoResponse(data);

  if (response.playabilityStatus.status === 'LOGIN_REQUIRED') {
    console.log('video is private', JSON.stringify(response.playabilityStatus, null, 2));
    const reason = getLoginRequiredReason(response.playabilityStatus);
    if (reason) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          visible: false,
          reason
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    }
    return {
      statusCode: 403
    };
  }

  if (response.playabilityStatus.status === 'ERROR') {
    console.log('video is not available', JSON.stringify(response.playabilityStatus, null, 2));
    return {
      statusCode: 200,
      body: JSON.stringify({
        visible: false,
        reason: 'removed'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      visible: true,
      ...getVideo(response)
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

const buildVideoPath = (videoId, url) => {
  if (videoId) {
    console.log('videoId', videoId);
    return `/watch?v=${videoId}`;
  } else if (url) {
    console.log('url', url);
    const { hostname, pathname, searchParams } = new URL(url);
    if (hostname === 'youtu.be') {
      return `/watch?v=${pathname.substring(1)}`;
    } else if (pathname === '/watch') {
      return `/watch?v=${searchParams.get('v')}`;
    } else {
      console.log('invalid url');
    }
  } else {
    console.log('missing videoId or url');
  }
};

const getLoginRequiredReason = (playabilityStatus) => {
  if (playabilityStatus.messages.includes('This is a private video. Please sign in to verify that you may see it.')) {
    return 'private';
  }
  if (playabilityStatus.reason === 'Sign in to confirm your age') {
    return 'age';
  }
  return null;
};

const getVideo = (response) => {
  const channelId = getVideoChannelId(response);
  console.log('channelId', channelId);
  const duration = getVideoDuration(response);
  console.log('duration', duration);
  const isLive = getVideoIsLive(response);
  console.log('isLive', isLive);
  const isLiveContent = getVideoIsLiveContent(response);
  console.log('isLiveContent', isLiveContent);
  const isUpcoming = getVideoIsUpcoming(response);
  console.log('isUpcoming', isUpcoming);
  const publishedDate = getVideoPublishedDate(response);
  console.log('publishedDate', publishedDate);
  const scheduledAt = getVideoScheduledAt(response);
  console.log('scheduledAt', scheduledAt);
  const title = getVideoTitle(response);
  console.log('title', title);
  const videoId = getVideoVideoId(response);
  console.log('videoId', videoId);

  return { channelId, duration, isLive, isLiveContent, isUpcoming, publishedDate, scheduledAt, title, videoId };
};

const getVideoResponse = (data) => {
  try {
    // YouTube randomly picks different response formats
    return data.playerResponse ?? data[2].playerResponse ?? JSON.parse(data[2].player.args.player_response);
  } catch (error) {
    console.log('failed to get channel response', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getVideoChannelId = (response) => {
  try {
    return response.videoDetails.channelId;
  } catch (error) {
    console.log('failed to get video channelId', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoDuration = (response) => {
  try {
    return parseInt(response.videoDetails.lengthSeconds, 10) ?? 0;
  } catch (error) {
    console.log('failed to get video duration', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoIsLive = (response) => {
  try {
    return response.videoDetails.isLive ?? false;
  } catch (error) {
    console.log('failed to get video isLive', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoIsLiveContent = (response) => {
  try {
    return response.videoDetails.isLiveContent ?? false;
  } catch (error) {
    console.log('failed to get video isLiveContent', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoIsUpcoming = (response) => {
  try {
    return response.videoDetails.isUpcoming ?? false;
  } catch (error) {
    console.log('failed to get video isUpcoming', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoPublishedDate = (response) => {
  try {
    return response.microformat.playerMicroformatRenderer.publishDate;
  } catch (error) {
    console.log('failed to get video publishedDate', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoScheduledAt = (response) => {
  try {
    return response.playabilityStatus.liveStreamability?.liveStreamabilityRenderer.offlineSlate?.liveStreamOfflineSlateRenderer.scheduledStartTime ?? null;
  } catch (error) {
    console.log('failed to get video scheduledAt', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoTitle = (response) => {
  try {
    return response.videoDetails.title;
  } catch (error) {
    console.log('failed to get video title', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getVideoVideoId = (response) => {
  try {
    return response.videoDetails.videoId;
  } catch (error) {
    console.log('failed to get video videoId', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

module.exports = {
  RateLimitedError,
  handleChannel,
  handleVideo
}
