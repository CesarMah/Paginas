import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.Vpc;
  lambdaSg: ec2.SecurityGroup;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  dbSecret: rds.DatabaseSecret;
  mediaBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly lambdaFunctions: lambda.Function[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, vpc, lambdaSg, userPool, userPoolClient, dbSecret, mediaBucket } = props;
    const isProd = stage === 'prod';

    // DynamoDB WebSocket connections table
    const connectionsTable = new dynamodb.Table(this, 'WsConnections', {
      tableName: 'gastroflow-ws-connections',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for disconnect lookup by connectionId
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'connectionId-index',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // SNS Topic
    const ordersTopic = new sns.Topic(this, 'OrdersTopic', {
      topicName: `gastroflow-new-order-${stage}`,
    });

    // WebSocket API
    const wsApi = new apigwv2.WebSocketApi(this, 'WsApi', {
      apiName: `gastroflow-ws-${stage}`,
    });

    const wsStage = new apigwv2.WebSocketStage(this, 'WsStage', {
      webSocketApi: wsApi,
      stageName: stage,
      autoDeploy: true,
    });

    const wsEndpoint = `https://${wsApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`;

    // Common Lambda env vars
    const commonEnv = {
      STAGE: stage,
      WS_ENDPOINT: wsEndpoint,
      SNS_TOPIC_ARN: ordersTopic.topicArn,
      CONNECTIONS_TABLE: connectionsTable.tableName,
      MEDIA_BUCKET: mediaBucket.bucketName,
    };

    const lambdaDefaults: Omit<lambda.FunctionProps, 'handler' | 'code'> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: isProd ? 512 : 256,
      timeout: cdk.Duration.seconds(29),
      tracing: lambda.Tracing.ACTIVE,
      vpc,
      securityGroups: [lambdaSg],
      vpcSubnets: { subnetType: isProd ? ec2.SubnetType.PRIVATE_WITH_EGRESS : ec2.SubnetType.PRIVATE_ISOLATED },
      environment: commonEnv,
    };

    const backendPath = path.join(__dirname, '../../backend');

    const makeLambda = (name: string, handlerPath: string, extraEnv?: Record<string, string>) => {
      const fn = new lambda.Function(this, name, {
        ...lambdaDefaults,
        functionName: `gastroflow-${stage}-${name.toLowerCase()}`,
        code: lambda.Code.fromAsset(backendPath),
        handler: `lambdas/${handlerPath}/index.handler`,
        environment: { ...commonEnv, ...extraEnv },
      });
      dbSecret.grantRead(fn);
      connectionsTable.grantReadWriteData(fn);
      mediaBucket.grantReadWrite(fn);
      ordersTopic.grantPublish(fn);
      return fn;
    };

    const ordersCreate = makeLambda('OrdersCreate', 'orders/create');
    const ordersList = makeLambda('OrdersList', 'orders/list');
    const ordersUpdateStatus = makeLambda('OrdersUpdateStatus', 'orders/update-status');
    const menuList = makeLambda('MenuList', 'menu/list');
    const menuUpsert = makeLambda('MenuUpsert', 'menu/upsert');
    const analyticsDaily = makeLambda('AnalyticsDaily', 'analytics/daily');
    const analyticsWeekly = makeLambda('AnalyticsWeekly', 'analytics/weekly');
    const inventoryList = makeLambda('InventoryList', 'inventory/list');
    const inventoryUpdate = makeLambda('InventoryUpdate', 'inventory/update');
    const wsConnect = makeLambda('WsConnect', 'websocket/connect', {
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
    });
    const wsDisconnect = makeLambda('WsDisconnect', 'websocket/disconnect');
    const sendEmail = new lambda.Function(this, 'SendEmail', {
      ...lambdaDefaults,
      functionName: `gastroflow-${stage}-send-email`,
      code: lambda.Code.fromAsset(backendPath),
      handler: 'lambdas/notifications/send-email/index.handler',
      vpc: undefined,
      securityGroups: undefined,
      vpcSubnets: undefined,
    });

    this.lambdaFunctions = [
      ordersCreate, ordersList, ordersUpdateStatus,
      menuList, menuUpsert, analyticsDaily, analyticsWeekly,
      inventoryList, inventoryUpdate, wsConnect, wsDisconnect, sendEmail,
    ];

    ordersTopic.addSubscription(new snsSubscriptions.LambdaSubscription(sendEmail));

    // WebSocket routes
    wsApi.addRoute('$connect', {
      integration: new apigwv2Integrations.WebSocketLambdaIntegration('ConnectInteg', wsConnect),
    });
    wsApi.addRoute('$disconnect', {
      integration: new apigwv2Integrations.WebSocketLambdaIntegration('DisconnectInteg', wsDisconnect),
    });
    wsApi.grantManageConnections(ordersCreate);
    wsApi.grantManageConnections(ordersUpdateStatus);

    // HTTP API
    const authorizer = new apigwv2Authorizers.HttpJwtAuthorizer('CognitoAuthorizer', userPool.userPoolProviderUrl, {
      jwtAudience: [userPoolClient.userPoolClientId],
    });

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `gastroflow-api-${stage}`,
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    });

    const addRoute = (
      method: apigwv2.HttpMethod,
      routePath: string,
      fn: lambda.Function
    ) => {
      this.httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration: new apigwv2Integrations.HttpLambdaIntegration(`${fn.node.id}Integ`, fn),
        authorizer,
      });
    };

    addRoute(apigwv2.HttpMethod.POST, '/orders', ordersCreate);
    addRoute(apigwv2.HttpMethod.GET, '/orders', ordersList);
    addRoute(apigwv2.HttpMethod.PATCH, '/orders/{id}', ordersUpdateStatus);
    addRoute(apigwv2.HttpMethod.GET, '/menu-items', menuList);
    addRoute(apigwv2.HttpMethod.POST, '/menu-items', menuUpsert);
    addRoute(apigwv2.HttpMethod.PUT, '/menu-items/{id}', menuUpsert);
    addRoute(apigwv2.HttpMethod.GET, '/reports/daily', analyticsDaily);
    addRoute(apigwv2.HttpMethod.GET, '/reports/weekly', analyticsWeekly);
    addRoute(apigwv2.HttpMethod.GET, '/inventory', inventoryList);
    addRoute(apigwv2.HttpMethod.PATCH, '/inventory/{id}', inventoryUpdate);

    new cdk.CfnOutput(this, 'HttpApiUrl', { value: this.httpApi.url! });
    new cdk.CfnOutput(this, 'WsApiUrl', { value: wsStage.url });
  }
}
