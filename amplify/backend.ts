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
  "IotData"

);

backend.data.addDynamoDbDataSource(
  "ExternalPostTableDataSource",
  externalTable
);