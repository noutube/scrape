const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

module.exports.forceColdStart = async (context) => {
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
