const { handleChannel, handleVideo } = require('./lib');

const {
  TOKEN
} = process.env;

const sendResponse = (res, response) => {
  res.status(response.statusCode);
  if (response.headers) {
    res.set(response.headers);
  }
  if (response.body) {
    res.send(response.body);
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

  if (req.method == 'GET' && req.path === '/channel') {
    const { channelId, url } = req.query;
    sendResponse(res, await handleChannel(channelId, url));
    return;
  } else if (req.method == 'GET' && req.path === '/video') {
    const { videoId, url } = req.query;
    sendResponse(res, await handleVideo(videoId, url));
    return;
  }

  res.sendStatus(404);
};
