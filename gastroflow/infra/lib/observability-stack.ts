import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

interface ObservabilityStackProps extends cdk.StackProps {
  stage: string;
  lambdaFunctions: lambda.Function[];
  httpApi: apigwv2.HttpApi;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { stage, lambdaFunctions, httpApi } = props;

    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `gastroflow-alerts-${stage}`,
    });

    const snsAction = new cloudwatchActions.SnsAction(alertTopic);

    // Lambda widgets and alarms
    const lambdaWidgets: cloudwatch.IWidget[] = lambdaFunctions.flatMap((fn) => [
      new cloudwatch.GraphWidget({
        title: `${fn.functionName} — Invocaciones & Errores`,
        left: [fn.metricInvocations()],
        right: [fn.metricErrors()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: `${fn.functionName} — Duración`,
        left: [
          fn.metricDuration({ statistic: 'p50' }),
          fn.metricDuration({ statistic: 'p95' }),
          fn.metricDuration({ statistic: 'p99' }),
        ],
        width: 12,
      }),
    ]);

    lambdaFunctions.forEach((fn) => {
      const errorAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ErrorAlarm`, {
        alarmName: `${fn.functionName}-error-rate`,
        metric: fn.metricErrors({ period: cdk.Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(snsAction);
    });

    // API Gateway metrics
    const apiWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway — 4xx & 5xx',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: { ApiId: httpApi.apiId },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: { ApiId: httpApi.apiId },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 24,
    });

    const latencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `gastroflow-${stage}-api-p95-latency`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'IntegrationLatency',
        dimensionsMap: { ApiId: httpApi.apiId },
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 500,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    latencyAlarm.addAlarmAction(snsAction);

    new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `GastroFlow-${stage}`,
      widgets: [
        [apiWidget],
        lambdaWidgets,
      ],
    });
  }
}
