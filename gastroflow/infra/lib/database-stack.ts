import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.Vpc;
  rdsSg: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbSecret: rds.DatabaseSecret;
  // No RDS Proxy in free-tier mode (saves ~$11/month)
  public readonly dbEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { stage, vpc, rdsSg } = props;
    const isProd = stage === 'prod';

    this.dbSecret = new rds.DatabaseSecret(this, 'DbSecret', {
      username: 'gastroflow',
      secretName: `gastroflow/${stage}/db-credentials`,
    });

    const instance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
      // t3.micro = free tier (750 hrs/month for 12 months)
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [rdsSg],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'gastroflow',
      multiAz: false,
      // Publicly accessible so Lambda (no-VPC) can connect directly
      publiclyAccessible: true,
      backupRetention: cdk.Duration.days(isProd ? 7 : 0),
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      storageEncrypted: true,
      allocatedStorage: 20, // minimum
    });

    this.dbEndpoint = instance.dbInstanceEndpointAddress;

    new cdk.CfnOutput(this, 'DbEndpoint', { value: instance.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbPort', { value: instance.dbInstanceEndpointPort });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: this.dbSecret.secretArn });
  }
}
