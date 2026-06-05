/*

import { util } from '@aws-appsync/utils';
export function request(ctx) {
  const nextToken = ctx.args.nextToken ?? null;

  return {
    operation: 'Query',
    index: 'Controller-Division-DatetimeAgg-index', // ← ここも確認
    query: {
      expression:
        'Controller = :controller AND Division = :division AND DatetimeAgg BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':division': ctx.args.Division,
        ':start': ctx.args.StartDatetime,
        ':end': ctx.args.EndDatetime,
      }),
    },
    limit: 1000,
    scanIndexForward: true,
    nextToken,
  };
}

export function response(ctx) {
  return {
    items: ctx.result?.items ?? [],
    nextToken: ctx.result?.nextToken ?? null,
  };
}
*/


import { util } from '@aws-appsync/utils';

export function request(ctx) {
  var nextToken = ctx.args.nextToken ? ctx.args.nextToken : null;

  return {
    operation: 'Query',
    index: 'Controller-Division-DatetimeAgg-index',
    query: {
      expression:
        'Controller = :controller AND Division = :division AND DatetimeAgg BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':division': ctx.args.Division,
        ':start': ctx.args.StartDatetime,
        ':end': ctx.args.EndDatetime,
      }),
    },
    limit: 1000,
    scanIndexForward: true,
    nextToken: nextToken,
  };
}

export function response(ctx) {

  var rawItems = [];
  if (ctx.result && ctx.result.items) {
    rawItems = ctx.result.items;
  }

  var items = [];

  for (var i = 0; i < rawItems.length; i++) {

    var item = rawItems[i];

    // ✅ 直接コピーしない（ここが重要）
    var out = {};

    // 必要なキーだけ手動コピー
    out.Controller = item.Controller;
    out.Division = item.Division;
    out.DivisionAgg = item.DivisionAgg;
    out.Device = item.Device;
    out.DeviceName = item.DeviceName;
    out.DeviceType = item.DeviceType;

    // ===== 日時 =====
    function toIso(v) {
      if (typeof v !== "string") return null;

      var s = v.trim();
      if (s === "") return null;

      if (s.indexOf(" ") !== -1 && s.indexOf("T") === -1) {
        s = s.replace(" ", "T");
      }

      var isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

      if (isoRegex.test(s) && !(/[+\-]\d{2}:\d{2}$/.test(s))) {
        s = s + "+09:00";
      }

      return s;
    }

    var datetime = null;

    if (item.DatetimeAgg != null) {
      datetime = toIso(item.DatetimeAgg);
    } else if (item.AggKey != null) {
      datetime = toIso(item.AggKey);
    }

    out.DatetimeAgg = datetime;
    out.DeviceDatetime = datetime;
    out.DeviceTimestamp = datetime;

    // ===== 数値 =====
    function toNumber(v) {
      if (v === null || v === undefined) return null;

      if (typeof v === "number") return v;

      if (typeof v === "string") {
        var n = Number(v);
        if (isFinite(n)) return n;
      }

      return null;
    }

    out.AvgActualTemp = toNumber(item.AvgActualTemp);
    out.AvgActualHumidity = toNumber(item.AvgActualHumidity);
    out.AvgActivePower = toNumber(item.AvgActivePower);
    out.SumCumulativeEnergy = toNumber(item.SumCumulativeEnergy);

    // alias補完
    if (!out.DivisionAgg) out.DivisionAgg = out.Division;
    if (!out.Device && out.DeviceName) out.Device = out.DeviceName;
    if (!out.DeviceName && out.Device) out.DeviceName = out.Device;

    items.push(out);
  }

  var nextToken = null;
  if (ctx.result && ctx.result.nextToken) {
    nextToken = ctx.result.nextToken;
  }

  return {
    items: items,
    nextToken: nextToken,
  };
}