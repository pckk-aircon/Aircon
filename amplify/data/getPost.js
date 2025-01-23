//step4にて追加。
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  return ddb.get({ key: { Device: ctx.args.Device } });
}

export const response = (ctx) => ctx.result;

//export function request(ctx) {
  //const ctx = {
    //args: {
      //ControllerDevice: "Mutsu01"
    //}
  //};

  //return {
    //operation: 'Query',
    //query: {
      //expression: 'Controller = :controller',
      //expressionValues: ddb.toMapValues({ ':controller': ControllerDevice })
    //},
    //index: 'Controller-DeviceType-index'
  //};
//}