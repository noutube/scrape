const pulumi = require('@pulumi/pulumi');
const gcp = require('@pulumi/gcp');

const config = new pulumi.Config();

const projectName = pulumi.getProject();
const token = config.requireSecret('token');
const gcpApiKey = config.requireSecret('gcpApiKey');

const code = new pulumi.asset.AssetArchive({
  '.': new pulumi.asset.FileArchive('../src')
});

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
      TOKEN: token,
      GCP_API_KEY: gcpApiKey
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

exports.url = cf.url;
