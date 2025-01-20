//step4にて追加。
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  //return ddb.get({ key: { id: ctx.args.id } });
  return ddb.get({ key: { Device: ctx.args.Device } });
}

export const response = (ctx) => ctx.result;