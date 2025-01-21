//step4にて追加。
import * as ddb from "@aws-appsync/utils/dynamodb";

//export function request(ctx) {

  //return ddb.get({ key: { id: ctx.args.id } });

//}

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const controller = 'Mutsu01';
  return {
    operation: 'Query',
    query: {
      expression: 'controller = :controller',
      expressionValues: util.dynamodb.toMapValues({ ':controller': controller })
    },
    index: 'controller-index'
  };
}