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
      expression: 'Controller = :controllerId',
      expressionValues: util.dynamodb.toMapValues({ ':controllerId': controller })
    },
    index: 'Controller-index'
  };
}