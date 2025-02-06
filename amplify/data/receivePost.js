/*
export function request() {
  return {};
}

export const response = (ctx) => {

  return ctx.result;
};
*/

export function request() {
  // リクエストを返す際には、通常の設定や初期化を行います。
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