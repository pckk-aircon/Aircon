/*
//step4にて追加。
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  return ddb.get({ key: { Device: ctx.args.Device } });
}

export const response = (ctx) => ctx.result;

*/

import { util } from '@aws-appsync/utils';

export function request(ctx) {
    return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller',
      expressionValues: util.dynamodb.toMapValues({ ':controller': ctx.args.Controller })
    },
    index: 'Controller-index'
  };
}
//export const response = (ctx) => ctx.result.items;

//log有り。
export const response = (ctx) => {
  console.log("Response context:", ctx);
  return ctx.result.items;
};
