const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');
const gcp = require('@pulumi/gcp');

const config = new pulumi.Config();

const projectName = pulumi.getProject();
const domain = config.require('domain');
const token = config.requireSecret('token');

const code = new pulumi.asset.AssetArchive({
  '.': new pulumi.asset.FileArchive('../src')
});

// Cloud Function

const bucket = new gcp.storage.Bucket(projectName, {
  name: `${projectName}-gcf-source`,
  location: 'AUSTRALIA-SOUTHEAST1',
  uniformBucketLevelAccess: true
});

const object = new gcp.storage.BucketObject(projectName, {
  name: `${projectName}.zip`,
  bucket: bucket.name,
  source: code
});

const cf = new gcp.cloudfunctionsv2.Function(projectName, {
  name: projectName,
  location: 'australia-southeast1',
  buildConfig: {
    runtime: 'nodejs20',
    entryPoint: 'handler',
    source: {
      storageSource: {
        bucket: bucket.name,
        object: object.name,
        generation: object.generation
      }
    }
  },
  serviceConfig: {
    maxInstanceCount: 1,
    environmentVariables: {
      TOKEN: token
    }
  }
});

// https://github.com/hashicorp/terraform-provider-google/issues/5833#issuecomment-1237493434
new gcp.cloudrun.IamBinding(`${projectName}-invoker`, {
  location: cf.location,
  service: cf.name,
  role: 'roles/run.invoker',
  members: [
    'allUsers'
  ]
});

// Lambda

const lambdaRole = new aws.iam.Role(projectName, {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'lambda.amazonaws.com'
  })
});

const lambda = new aws.lambda.Function(projectName, {
  code,
  runtime: 'nodejs20.x',
  role: lambdaRole.arn,
  handler: 'aws.handler',
  timeout: 30,
  memorySize: 128,
  environment: {
    variables: {
      TOKEN: token,
      GCP_URL: cf.url
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
