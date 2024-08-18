const { Lambda } = require('@aws-sdk/client-lambda');

const { RateLimitedError, handleChannel, handleVideo } = require('./lib');

const {
  GCP_URL,
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

const proxyRequest = async (resource, query) => {
  const queryString = new URLSearchParams({ ...query, token: TOKEN });
  const url = `${GCP_URL}/${resource}?${queryString}`;
  const response = await fetch(url);
  if (!response.ok) {
    return {
      statusCode: response.status
    };
  }
  return {
    statusCode: 200,
    body: await response.text(),
    headers: {
      'Content-Type': 'application/json'
    }
  };
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
      return await proxyRequest('channel', { channelId, url });
    } else if (routeKey === 'GET /video') {
      const { videoId, url } = event.queryStringParameters;
      return await proxyRequest('video', { videoId, url });
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
