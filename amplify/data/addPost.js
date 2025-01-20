//step4にて追加。
import { util } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  const item = { ...ctx.arguments, ups: 1, downs: 0, version: 1 };
  const key = {
    Device: ctx.args.Device ?? util.autoId(),
    DeviceDatetime: ctx.args.DeviceDatetime ?? new Date().toISOString(),
  }; 
  return ddb.put({ key, item });
}


export function response(ctx) {
  return ctx.result;
}