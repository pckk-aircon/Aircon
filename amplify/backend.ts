/*

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
<<<<<<< HEAD
import { aws_dynamodb, Stack } from "aws-cdk-lib";
import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
=======

import { aws_dynamodb } from "aws-cdk-lib"; //step2にて追加。
>>>>>>> a9c9ba4a4c2c183baacac69f47fc5f24e1b60458

export const backend = defineBackend({
  auth,
  data,
});

const externalDataSourcesStack = backend.createStack("MyExternalDataSources");

function createDynamoDbDataSource(
  stack: Stack,
  DynamoDbtableName: string,
  tableName: string,
  dataSourceName: string,
  policyName: string
) {
  //const table = aws_dynamodb.Table.fromTableName(stack, tableName, "IotData");
  const table = aws_dynamodb.Table.fromTableName(stack, tableName, DynamoDbtableName);

  const dataSource = backend.data.addDynamoDbDataSource(dataSourceName, table);

  const role = Role.fromRoleArn(stack, `${dataSourceName}Role`, dataSource.ds.serviceRoleArn ?? '');

  const policy = new Policy(stack, policyName, {
    //policyName: `amplify-permissions-${dataSourceName}`,
    policyName: "amplify-permissions-external-table",
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["dynamodb:Query"],
        resources: [`${table.tableArn}/index/*`],
      }),
    ],
  });

  role.attachInlinePolicy(policy);

  return dataSource;
}

// ここで関数を呼び出してデータソースを作成します。

const DeviceTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "DeviceTable",//DynamoDbtableName
  "MyDeviceTable",//tableName
  "DeviceDataSource",//dataSourceName
  "DeviceIamPolicy"
);

const DivisionTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "DivisionTable",//DynamoDbtableName
  "MyDivisionTable",//tableName
  "DivisionDataSource",//dataSourceName
  "DivisionIamPolicy"
);

const IotTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "IotData",//DynamoDbtableName
  "MyIotTable",//tableName
  "IotSource",//dataSourceName
  "IotIamPolicy",//
);

*/

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { aws_dynamodb, Stack } from "aws-cdk-lib";
import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

<<<<<<< HEAD
export const backend = defineBackend({
  auth,
  data,
=======
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
>>>>>>> a9c9ba4a4c2c183baacac69f47fc5f24e1b60458
});

const externalDataSourcesStack = backend.createStack("MyExternalDataSources");

function createDynamoDbDataSource(
  stack: Stack,
  DynamoDbtableName: string,
  tableName: string,
  dataSourceName: string,
  policyName: string
) {
  //const table = aws_dynamodb.Table.fromTableName(stack, tableName, "IotData");
  const table = aws_dynamodb.Table.fromTableName(stack, tableName, DynamoDbtableName);

  const dataSource = backend.data.addDynamoDbDataSource(dataSourceName, table);

  const role = Role.fromRoleArn(stack, `${dataSourceName}Role`, dataSource.ds.serviceRoleArn ?? '');

  const policy = new Policy(stack, policyName, {
    //policyName: `amplify-permissions-${dataSourceName}`,
    policyName: "amplify-permissions-external-table",
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["dynamodb:Query"],
        resources: [`${table.tableArn}/index/*`],
      }),
    ],
  });

  role.attachInlinePolicy(policy);

  return dataSource;
}

// ここで関数を呼び出してデータソースを作成します。

const DeviceTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "DeviceTable",//DynamoDbtableName
  "MyDeviceTable",//tableName
  "DeviceDataSource",//dataSourceName
  "DeviceIamPolicy"
);

const DivisionTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "DivisionTable",//DynamoDbtableName
  "MyDivisionTable",//tableName
  "DivisionDataSource",//dataSourceName
  "DivisionIamPolicy"
);

const IotTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "IotData",//DynamoDbtableName
  "MyIotTable",//tableName
  "IotDataSource",//dataSourceName
  "IotIamPolicy",//
);