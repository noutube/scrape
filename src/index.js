const { handleChannel, handleVideo } = require('./data');

const {
  TOKEN
} = process.env;

const sendResponse = (res, response) => {
  if (response.headers) {
    res.set(response.headers);
  }
  if (response.body) {
    res.status(response.statusCode);
    res.send(response.body);
  } else {
    res.sendStatus(response.statusCode);
  }
};

exports.handler = async (req, res) => {
  console.log('event', {
    path: req.path,
    query: req.query
  });

  const { token } = req.query;
  if (token !== TOKEN) {
    res.sendStatus(401);
    return;
  }

  try {
    if (req.method == 'GET' && req.path === '/channel') {
      const { channelId, url } = req.query;
      sendResponse(res, await handleChannel(channelId, url));
      return;
    } else if (req.method == 'GET' && req.path === '/video') {
      const { videoId, url } = req.query;
      sendResponse(res, await handleVideo(videoId, url));
      return;
    }
  } catch (error) {
    console.log('handler failed', error);
  }

  res.sendStatus(404);
};
