import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';

import { aws_dynamodb } from "aws-cdk-lib"; //step2にて追加。


export const backend = defineBackend({
  auth,
  data,
});


//step2にて追加。
const externalDataSourcesStack = backend.createStack("MyExternalDataSources");

const externalTable = aws_dynamodb.Table.fromTableName(
  externalDataSourcesStack,
  "MyExternalPostTable",
  "IotData"

);

//新しいテーブル（IoTData）の設定を追加
const iotTable = aws_dynamodb.Table.fromTableName(
  externalDataSourcesStack,
  "MyIotPostTable",
  "IotData"
);

//2025.1.23サポート様より提示。
//addDynamoDbDataSource() により作成されるデータソースには新規のIAMロールが作成される一方、
// 作成されたIAMロールには許可されるresourcesにindexが含まれていないため、
//データソースのIAMロールにindexへのQueryアクションの権限を追加。

import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

const externalTableDS = backend.data.addDynamoDbDataSource(
  "ExternalPostTableDataSource",
  externalTable
);

//ここからは共通。
const dsRole = Role.fromRoleArn(
  externalDataSourcesStack,
  "DatasourceRole",
  externalTableDS.ds.serviceRoleArn ?? ''
)

const datasourceIamPolicy = new Policy(externalDataSourcesStack, "datasourceIamPolicy", {
  policyName: "amplify-permissions-external-table",
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "dynamodb:Query"
      ],
      resources: [
        `${externalTable.tableArn}/index/*`
      ],
    })
  ],
});

dsRole.attachInlinePolicy(datasourceIamPolicy);
