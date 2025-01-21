//step4にて追加。
//import * as ddb from "@aws-appsync/utils/dynamodb";

//export function request(ctx) {

  //return ddb.get({ key: { id: ctx.args.id } });

//}

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { owner } = ctx.args;
  return {
    operation: 'Query',
    query: {
 
    },
    index: 'Controller-index'
  };
}