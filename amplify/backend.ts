/*
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

//DeviceTableの設定を追加
//const iotTable = aws_dynamodb.Table.fromTableName(
const DeviceTable = aws_dynamodb.Table.fromTableName(//★
  externalDataSourcesStack,
  "MyDeviceTable",
  //"IotData"
  "DeviceTable"//★テーブル名
);

//2025.1.23サポート様より提示。
//addDynamoDbDataSource() により作成されるデータソースには新規のIAMロールが作成される一方、
// 作成されたIAMロールには許可されるresourcesにindexが含まれていないため、
//データソースのIAMロールにindexへのQueryアクションの権限を追加。

import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

const externalTableDS = backend.data.addDynamoDbDataSource(
  "ExternalPostTableDataSource",
  //"IotPostTableDataSource",//★★
  externalTable//こちらは変数名。次のRoleと関連か。
);

//DeviceTableの設定を追加
const DeviceDS = backend.data.addDynamoDbDataSource(
  "DeviceDataSource",//データソース名
  DeviceTable//テーブル名
);

//dsRoleは、externalTableDSのIAMロールを取得おり、同じロールをDeviceTableにも適用可能。
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
        `${externalTable.tableArn}/index/*`,
        `${DeviceTable.tableArn}/index/*`, // DeviceTableのリソースを追加
      ],
    })
  ],
});

dsRole.attachInlinePolicy(datasourceIamPolicy);
*/

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


//2025.1.23サポート様より提示。
//addDynamoDbDataSource() により作成されるデータソースには新規のIAMロールが作成される一方、
// 作成されたIAMロールには許可されるresourcesにindexが含まれていないため、
//データソースのIAMロールにindexへのQueryアクションの権限を追加。

import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

const externalTableDS = backend.data.addDynamoDbDataSource(
  "ExternalPostTableDataSource",
  externalTable//こちらは変数名。次のRoleと関連か。
);

//dsRoleは、externalTableDSのIAMロールを取得おり、同じロールをDeviceTableにも適用可能。
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
        `${externalTable.tableArn}/index/*`,
      ],
    })
  ],
});

dsRole.attachInlinePolicy(datasourceIamPolicy);

