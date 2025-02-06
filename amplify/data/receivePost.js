/*
export function request() {
  return {};
}

export const response = (ctx) => {
  return ctx.result;
};
*/


export function request() {
  return {};
}

export const response = (ctx) => {
  // リクエストからフィールドの値を取得します。
  const deviceType = ctx.args.DeviceType;
  const division = ctx.args.Division;

  return {
    ...ctx.result,
    DeviceType: deviceType,
    Division: division
  };
};