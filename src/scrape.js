const youtube = require('./youtube');

const {
  TOKEN
} = process.env;

exports.handler = async (event, context) => {
  console.log('event', event);

  const { token } = event.queryStringParameters;
  /*
  if (token !== TOKEN) {
    return {
      statusCode: 401
    };
  }
  */

  const { routeKey } = event;
  if (routeKey === 'GET /channel') {
    return await youtube.scrapeChannel(event, context);
  } else if (routeKey === 'GET /video') {
    return await youtube.scrapeVideo(event, context);
  }

  return {
    statusCode: 404
  };
};
