const { Lambda } = require('@aws-sdk/client-lambda');

const { RateLimitedError, handleChannel, handleVideo } = require('./lib');

const {
  TOKEN
} = process.env;

const forceColdStart = async (context) => {
  const timestamp = new Date().toISOString();
  console.log('force cold start', context.functionName, timestamp);

  const lambda = new Lambda({});
  const currentFunctionConfiguration = await lambda.getFunctionConfiguration({ FunctionName: context.functionName });

  await lambda.updateFunctionConfiguration({
    FunctionName: context.functionName,
    Environment: {
      Variables: {
        ...currentFunctionConfiguration.Environment.Variables,
        TIMESTAMP: timestamp
      }
    }
  });
};

exports.handler = async function(event, context) {
  console.log('event', event);

  const { token } = event.queryStringParameters;
  if (token !== TOKEN) {
    return {
      statusCode: 401
    };
  }

  try {
    const { routeKey } = event;
    if (routeKey === 'GET /channel') {
      const { channelId, url } = event.queryStringParameters;
      return await handleChannel(channelId, url);
    } else if (routeKey === 'GET /video') {
      const { videoId, url } = event.queryStringParameters;
      return await handleVideo(videoId, url);
    }
  } catch (error) {
    console.log('handler failed', error);
    if (error instanceof RateLimitedError) {
      forceColdStart(context);
    }
  }

  return {
    statusCode: 404
  };
};
