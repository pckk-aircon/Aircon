//step4にて追加。
//import * as ddb from "@aws-appsync/utils/dynamodb";

//export function request(ctx) {

  //return ddb.get({ key: { id: ctx.args.id } });

//}

import { util } from '@aws-appsync/utils';


export function request(ctx) {
  return {
    //operation: 'Query',
    //query: {
      //expression: 'Controller = :ControllerHolder',
      //expressionValues: util.dynamodb.toMapValues({ ':ControllerHolder': 'Mutsu01' })
    //},
    //index: 'Controller-index'
  };
}