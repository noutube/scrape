const axios = require('axios');

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

const {
  LAMBDA_FUNCTION_NAME,
  TOKEN
} = process.env;

const forceColdStart = async () => {
  const timestamp = new Date().toISOString();
  console.log('force cold start', LAMBDA_FUNCTION_NAME, timestamp);

  const currentFunctionConfiguration = await lambda.getFunctionConfiguration({ FunctionName: LAMBDA_FUNCTION_NAME }).promise();

  await lambda.updateFunctionConfiguration({
    FunctionName: LAMBDA_FUNCTION_NAME,
    Environment: {
      Variables: {
        ...currentFunctionConfiguration.Environment.Variables,
        TIMESTAMP: timestamp
      }
    }
  }).promise();
};

const getData = async (url) => {
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
    if (error.response && error.response.status === 429) {
      forceColdStart();
    }
    throw error;
  }
};

const getDuration = (data) => {
  try {
    // YouTube randomly picks different response formats
    const playerResponse = data[2].playerResponse || JSON.parse(data[2].player.args.player_response);
    return parseInt(playerResponse.videoDetails.lengthSeconds, 10) || 0;
  } catch (error) {
    // allow us to debug new formats
    console.log('failed to get duration', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getLive = (data) => {
  try {
    // YouTube randomly picks different response formats
    const playerResponse = data[2].playerResponse || JSON.parse(data[2].player.args.player_response);
    return playerResponse.videoDetails.isLiveContent || false;
  } catch (error) {
    // allow us to debug new formats
    console.log('failed to get live', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getUpcoming = (data) => {
  try {
    // YouTube randomly picks different response formats
    const playerResponse = data[2].playerResponse || JSON.parse(data[2].player.args.player_response);
    return playerResponse.videoDetails.isUpcoming || false;
  } catch (error) {
    // allow us to debug new formats
    console.log('failed to get upcoming', error, JSON.stringify(data, null, 2));
    throw error;
  }
};

const getThumbnail = (data) => {
  try {
    return data[1].response.header.c4TabbedHeaderRenderer.avatar.thumbnails[1].url;
  } catch (error) {
    // allow us to debug new formats
    console.log('failed to get thumbnail', error, JSON.stringify(data, null, 2));
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
  if (routeKey === 'GET /duration') {
    const { videoId } = event.queryStringParameters;
    const data = await getData(`https://www.youtube.com/watch?v=${videoId}&pbj=1`);
    const duration = getDuration(data);
    console.log('duration', duration);
    const live = getLive(data);
    console.log('live', live);
    const upcoming = getUpcoming(data);
    console.log('upcoming', upcoming);
    return {
      statusCode: 200,
      body: JSON.stringify({ duration, live, upcoming }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } else if (routeKey === 'GET /thumbnail') {
    const { channelId } = event.queryStringParameters;
    const data = await getData(`https://www.youtube.com/channel/${channelId}?pbj=1`);
    const thumbnail = getThumbnail(data);
    console.log('thumbnail', thumbnail);
    return {
      statusCode: 200,
      body: JSON.stringify({ thumbnail }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  return {
    statusCode: 404
  };
};
