const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');

const config = new pulumi.Config();

const projectName = pulumi.getProject();
const domain = config.require('domain');
const token = config.requireSecret('token');

// Lambda

const lambdaRole = new aws.iam.Role(projectName, {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'lambda.amazonaws.com'
  })
});

const lambda = new aws.lambda.Function(projectName, {
  code: new pulumi.asset.AssetArchive({
    '.': new pulumi.asset.FileArchive('../src')
  }),
  runtime: 'nodejs20.x',
  role: lambdaRole.arn,
  handler: 'scrape.handler',
  timeout: 30,
  memorySize: 128,
  environment: {
    variables: {
      TOKEN: token
    }
  }
});

new aws.iam.RolePolicyAttachment(projectName, {
  role: lambdaRole,
  policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole
});

const lambdaColdStartPolicy = new aws.iam.Policy(`${projectName}-cold-start`, {
  path: '/',
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'lambda:UpdateFunctionConfiguration',
          'lambda:GetFunctionConfiguration'
        ],
        Resource: lambda.arn
      }
    ]
  }
});

new aws.iam.RolePolicyAttachment(`${projectName}-cold-start`, {
  role: lambdaRole,
  policyArn: lambdaColdStartPolicy.arn
});

// API Gateway

// XXX: manually create CNAME domain -> apigw.apiEndpoint
const apigw = new aws.apigatewayv2.Api(projectName, {
  protocolType: 'HTTP',
  disableExecuteApiEndpoint: true
});

const stage = new aws.apigatewayv2.Stage(projectName, {
  apiId: apigw.id,
  name: '$default',
  autoDeploy: true
});

// XXX: manually create CNAME resourceRecordName -> resourceRecordValue
const certificate = new aws.acm.Certificate(projectName, {
  domainName: domain,
  validationMethod: 'DNS'
});

const certificateValidation = new aws.acm.CertificateValidation(projectName, {
  certificateArn: certificate.arn,
  validationRecordFqdns: [certificate.domainValidationOptions[0].resourceRecordName]
});

const domainName = new aws.apigatewayv2.DomainName(projectName, {
  domainName: domain,
  domainNameConfiguration: {
    certificateArn: certificateValidation.certificateArn,
    endpointType: 'REGIONAL',
    securityPolicy: 'TLS_1_2'
  }
});

new aws.apigatewayv2.ApiMapping(projectName, {
  apiId: apigw.id,
  domainName: domainName.id,
  stage: stage.id
});

const integration = new aws.apigatewayv2.Integration(projectName, {
  apiId: apigw.id,
  integrationType: 'AWS_PROXY',
  integrationUri: lambda.arn,
  integrationMethod: 'POST',
  payloadFormatVersion: '2.0'
});

// TODO: can't get $default route sourceArn to work
// https://github.com/aws/serverless-application-model/issues/1860
['video', 'channel'].forEach((route) => {
  new aws.apigatewayv2.Route(`${projectName}-${route}`, {
    apiId: apigw.id,
    routeKey: `GET /${route}`,
    target: pulumi.interpolate`integrations/${integration.id}`
  });

  new aws.lambda.Permission(`${projectName}-${route}`, {
    action: 'lambda:InvokeFunction',
    function: lambda,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${apigw.executionArn}/*/GET/${route}`,
  });
});
