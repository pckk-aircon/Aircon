//step4にて追加。
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  //const { ControllerDevice } = ctx.args;

  const ctx = {
    args: {
      ControllerDevice: "Mutsu01"
    }
  };

  
  return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller',
      expressionValues: ddb.toMapValues({ ':controller': ControllerDevice })
    },
    index: 'Controller-DeviceType-index'
  };
}