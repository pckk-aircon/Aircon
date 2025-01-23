import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';

import { aws_dynamodb } from "aws-cdk-lib"; //step2にて追加。

//defineBackend({ //step2にて修正。
export const backend = defineBackend({
  auth,
  data,
});



//step2にて追加。
const externalDataSourcesStack = backend.createStack("MyExternalDataSources");

const externalTable = aws_dynamodb.Table.fromTableName(
  externalDataSourcesStack,
  "MyExternalPostTable",
  "DeviceTable"
);

//backend.data.addDynamoDbDataSource(
  //"ExternalPostTableDataSource",
  //externalTable
//);




import { Role, Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

//中略

const externalTableDS = backend.data.addDynamoDbDataSource(
//backend.data.addDynamoDbDataSource(
  "ExternalPostTableDataSource",
  externalTable
);

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