const axios = require('axios');

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

const {
  TOKEN
} = process.env;

const forceColdStart = async (context) => {
  const timestamp = new Date().toISOString();
  console.log('force cold start', context.functionName, timestamp);

  const currentFunctionConfiguration = await lambda.getFunctionConfiguration({ FunctionName: context.functionName }).promise();

  await lambda.updateFunctionConfiguration({
    FunctionName: context.functionName,
    Environment: {
      Variables: {
        ...currentFunctionConfiguration.Environment.Variables,
        TIMESTAMP: timestamp
      }
    }
  }).promise();
};

const getData = async (url, context) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20200214.04.00'
      }
    });
    return data;
  } catch (error) {
    console.log('failed to get data', error);
    if (error.response?.status === 429) {
      forceColdStart(context);
    }
    throw error;
  }
};

exports.handler = async function(event, context) {
  console.log('event', event);

  const { token } = event.queryStringParameters;
  if (token !== TOKEN) {
    return {
      statusCode: 401
    };
  }

  const { routeKey } = event;
  if (routeKey === 'GET /channel') {
    const { channelId } = event.queryStringParameters;
    console.log('channelId', channelId);

    const data = await getData(`https://www.youtube.com/channel/${channelId}?pbj=1`, context);
    const response = getChannelResponse(data);

    if (response.alerts) {
      const alerts = response.alerts.map((alert) => alert.alertRenderer.text.simpleText);
      console.log('channel has alerts', alerts, JSON.stringify(response.alerts, null, 2));
      return {
        statusCode: 403
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(getChannel(response)),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } else if (routeKey === 'GET /video') {
    const { videoId } = event.queryStringParameters;
    console.log('videoId', videoId);

    const data = await getData(`https://www.youtube.com/watch?v=${videoId}&pbj=1`, context);
    const response = getVideoResponse(data);

    if (response.playabilityStatus.status === 'LOGIN_REQUIRED') {
      console.log('video is private', JSON.stringify(response.playabilityStatus, null, 2));
      return {
        statusCode: 403
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(getVideo(response)),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  return {
    statusCode: 404
  };
};

// channel

const getChannel = (response) => {
  const thumbnail = getChannelThumbnail(response);
  console.log('thumbnail', thumbnail);
  const title = getChannelTitle(response);
  console.log('title', title);

  return { thumbnail, title };
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

const getChannelThumbnail = (response) => {
  try {
    return response.header.c4TabbedHeaderRenderer.avatar.thumbnails[1].url;
  } catch (error) {
    console.log('failed to get channel thumbnail', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

const getChannelTitle = (response) => {
  try {
    return response.header.c4TabbedHeaderRenderer.title;
  } catch (error) {
    console.log('failed to get channel title', error, JSON.stringify(response, null, 2));
    throw error;
  }
};

// video

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

  return { channelId, duration, isLive, isLiveContent, isUpcoming, publishedDate, scheduledAt, title };
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
    return response.playabilityStatus.liveStreamability?.liveStreamabilityRenderer.offlineSlate.liveStreamOfflineSlateRenderer.scheduledStartTime ?? null;
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
