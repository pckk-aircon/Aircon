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
*/

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { aws_dynamodb, Stack } from "aws-cdk-lib";
import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

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

/*
const externalTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "IotData",//DynamoDbtableName
  "MyExternalPostTable",//tableName
  "ExternalPostTableDataSource",//dataSourceName
  "IotIamPolicy",//
);
*/

const DivisionTableDS = createDynamoDbDataSource(
  externalDataSourcesStack,
  "DeviceTable",//DynamoDbtableName  
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