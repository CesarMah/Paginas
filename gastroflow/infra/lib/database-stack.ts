import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.Vpc;
  lambdaSg: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbSecret: rds.DatabaseSecret;
  public readonly dbProxy: rds.DatabaseProxy;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { stage, vpc, lambdaSg } = props;
    const isProd = stage === 'prod';

    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      description: 'RDS security group',
      allowAllOutbound: false,
    });
    rdsSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'Lambda access');

    this.dbSecret = new rds.DatabaseSecret(this, 'DbSecret', {
      username: 'gastroflow',
      secretName: `gastroflow/${stage}/db-credentials`,
    });

    const instance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
      instanceType: isProd
        ? ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'gastroflow',
      multiAz: isProd,
      backupRetention: isProd ? cdk.Duration.days(7) : cdk.Duration.days(0),
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      storageEncrypted: true,
    });

    if (isProd) {
      this.dbSecret.addRotationSchedule('RotationSchedule', {
        automaticallyAfter: cdk.Duration.days(30),
        hostedRotation: secretsmanager.HostedRotation.postgreSqlSingleUser({ vpc }),
      });
    }

    this.dbProxy = new rds.DatabaseProxy(this, 'DbProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(instance),
      secrets: [this.dbSecret],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      requireTLS: true,
      idleClientTimeout: cdk.Duration.minutes(10),
      dbProxyName: `gastroflow-proxy-${stage}`,
    });

    this.dbProxy.grantConnect(
      new cdk.aws_iam.ArnPrincipal(`arn:aws:iam::${this.account}:root`),
      'gastroflow'
    );

    new cdk.CfnOutput(this, 'DbProxyEndpoint', { value: this.dbProxy.endpoint });
  }
}
