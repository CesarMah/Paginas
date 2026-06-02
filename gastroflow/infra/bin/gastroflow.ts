import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { AuthStack } from '../lib/auth-stack';
import { DatabaseStack } from '../lib/database-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { ObservabilityStack } from '../lib/observability-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') as string || 'dev';

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stackPrefix = `GastroFlow-${stage}`;

const networkStack = new NetworkStack(app, `${stackPrefix}-Network`, { env, stage });
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, { env, stage });
const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  stage,
  vpc: networkStack.vpc,
  lambdaSg: networkStack.lambdaSg,
});
const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, { env, stage });
const apiStack = new ApiStack(app, `${stackPrefix}-Api`, {
  env,
  stage,
  vpc: networkStack.vpc,
  lambdaSg: networkStack.lambdaSg,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  dbSecret: databaseStack.dbSecret,
  mediaBucket: storageStack.mediaBucket,
});
new ObservabilityStack(app, `${stackPrefix}-Observability`, {
  env,
  stage,
  lambdaFunctions: apiStack.lambdaFunctions,
  httpApi: apiStack.httpApi,
});

app.synth();
