import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  stage: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { stage } = props;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `gastroflow-${stage}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({ mutable: false }),
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Attributes the client can read from the ID token (must be explicit for custom attrs)
    const readAttrs = new cognito.ClientAttributes()
      .withStandardAttributes({ email: true, emailVerified: true, fullname: true })
      .withCustomAttributes('tenantId', 'role');

    const writeAttrs = new cognito.ClientAttributes()
      .withStandardAttributes({ email: true, fullname: true })
      .withCustomAttributes('role');

    this.userPoolClient = this.userPool.addClient('SpaClient', {
      userPoolClientName: `gastroflow-spa-${stage}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
      },
      // No OAuth flows — SPA uses SRP/password auth directly
      disableOAuth: true,
      readAttributes:  readAttrs,
      writeAttributes: writeAttrs,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
  }
}
