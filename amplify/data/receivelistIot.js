export function request() {
  // リクエストを返す際には、通常の設定や初期化を行います。
  return {};
}

export const response = (ctx) => {
  // リクエストからフィールドの値を取得。
  const deviceType = ctx.args.DeviceType;
  const division = ctx.args.Division;
  const targetTemp = ctx.args.TargetTemp;
  const presetTemp = ctx.args.PresetTemp;
  const actualTemp = ctx.args.ActualTemp;
  const actualHumidity = ctx.args.ActualHumidity;

  return {
    ...ctx.result,
    DeviceType: deviceType,
    Division: division,
    TargetTemp: targetTemp,
    PresetTemp: presetTemp,
    ActualTemp: actualTemp,
    ActualHumidity: actualHumidity,
  };
};