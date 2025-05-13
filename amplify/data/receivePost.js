<<<<<<< HEAD

=======
/*
>>>>>>> a9c9ba4a4c2c183baacac69f47fc5f24e1b60458
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
  // リクエストからフィールドの値を取得。
  const deviceType = ctx.args.DeviceType;
  const division = ctx.args.Division;
  const actualTemp = ctx.args.ActualTemp;
  const actualHumidity = ctx.args.ActualHumidity;

  return {
    ...ctx.result,
    DeviceType: deviceType,
    Division: division,
    ActualTemp: actualTemp,
    ActualHumidity: actualHumidity,
  };
};