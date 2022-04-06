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

const getPlayerResponse = (data) => {
  // YouTube randomly picks different response formats
  return data.playerResponse ?? data[2].playerResponse ?? JSON.parse(data[2].player.args.player_response);
};

const getResponse = (data) => {
  // YouTube randomly picks different response formats
  return data.response ?? data[1].response;
};

const getChannelId = (data) => {
  try {
    return getPlayerResponse(data).videoDetails.channelId;
  } catch (error) {
    console.log('failed to get channelId', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getChannelTitle = (data) => {
  try {
    return getResponse(data).header.c4TabbedHeaderRenderer.title;
  } catch (error) {
    console.log('failed to get title', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getDuration = (data) => {
  try {
    return parseInt(getPlayerResponse(data).videoDetails.lengthSeconds, 10) ?? 0;
  } catch (error) {
    console.log('failed to get duration', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getIsLive = (data) => {
  try {
    return getPlayerResponse(data).videoDetails.isLive ?? false;
  } catch (error) {
    console.log('failed to get isLive', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getIsLiveContent = (data) => {
  try {
    return getPlayerResponse(data).videoDetails.isLiveContent ?? false;
  } catch (error) {
    console.log('failed to get isLiveContent', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getIsUpcoming = (data) => {
  try {
    return getPlayerResponse(data).videoDetails.isUpcoming ?? false;
  } catch (error) {
    console.log('failed to get isUpcoming', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getPublishedDate = (data) => {
  try {
    return getPlayerResponse(data).microformat.playerMicroformatRenderer.publishDate;
  } catch (error) {
    console.log('failed to get publishedDate', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getScheduledAt = (data) => {
  try {
    return getPlayerResponse(data).playabilityStatus.liveStreamability?.liveStreamabilityRenderer.offlineSlate.liveStreamOfflineSlateRenderer.scheduledStartTime ?? null;
  } catch (error) {
    console.log('failed to get scheduledAt', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getThumbnail = (data) => {
  try {
    return getResponse(data).header.c4TabbedHeaderRenderer.avatar.thumbnails[1].url;
  } catch (error) {
    console.log('failed to get thumbnail', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getVideoTitle = (data) => {
  try {
    return getPlayerResponse(data).videoDetails.title;
  } catch (error) {
    console.log('failed to get title', error, JSON.stringify(data, null, 2));
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
  if (routeKey === 'GET /video') {
    const { videoId } = event.queryStringParameters;
    const data = await getData(`https://www.youtube.com/watch?v=${videoId}&pbj=1`, context);
    const channelId = getChannelId(data);
    console.log('channelId', channelId);
    const duration = getDuration(data);
    console.log('duration', duration);
    const isLive = getIsLive(data);
    console.log('isLive', isLive);
    const isLiveContent = getIsLiveContent(data);
    console.log('isLiveContent', isLiveContent);
    const isUpcoming = getIsUpcoming(data);
    console.log('isUpcoming', isUpcoming);
    const publishedDate = getPublishedDate(data);
    console.log('publishedDate', publishedDate);
    const scheduledAt = getScheduledAt(data);
    console.log('scheduledAt', scheduledAt);
    const title = getVideoTitle(data);
    console.log('title', title);
    return {
      statusCode: 200,
      body: JSON.stringify({ channelId, duration, isLive, isLiveContent, isUpcoming, publishedDate, scheduledAt, title }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } else if (routeKey === 'GET /channel') {
    const { channelId } = event.queryStringParameters;
    const data = await getData(`https://www.youtube.com/channel/${channelId}?pbj=1`, context);
    const thumbnail = getThumbnail(data);
    console.log('thumbnail', thumbnail);
    const title = getChannelTitle(data);
    console.log('title', title);
    return {
      statusCode: 200,
      body: JSON.stringify({ thumbnail, title }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  return {
    statusCode: 404
  };
};
