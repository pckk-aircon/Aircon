//step4にて追加。
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  return ddb.get({
    key: {
      Device: ctx.args.Device,
      DeviceDatetime: ctx.args.DeviceDatetime
    }
  });
}

export const response = (ctx) => ctx.result;