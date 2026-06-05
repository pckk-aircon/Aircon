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
    var out = {};

    // =========================
    // コピー
    // =========================
    for (var key in item) {
      out[key] = item[key];
    }

    // =========================
    // 日時変換
    // =========================
    function toIso(v) {
      if (typeof v !== "string") return null;

      var s = v.trim();
      if (!s) return null;

      if (s.indexOf(" ") !== -1 && s.indexOf("T") === -1) {
        s = s.replace(" ", "T");
      }

      var isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

      if (isoRegex.test(s) && !(/[+\-]\d{2}:\d{2}$/.test(s))) {
        s = s + "+09:00";
      }

      return s;
    }

    // =========================
    // 数値変換
    // =========================
    function toNumber(v) {
      if (v === null || v === undefined) return null;

      if (typeof v === "number") return v;

      if (typeof v === "string") {
        var n = Number(v.replace(/,/g, ""));
        return isFinite(n) ? n : null;
      }

      return null;
    }

    // =========================
    // ✅ 時刻生成（重要）
    // =========================
    var datetime = null;

    if (item.DatetimeAgg) {
      datetime = toIso(item.DatetimeAgg);
    } else if (item.AggKey) {
      datetime = toIso(item.AggKey);
    }

    out.DatetimeAgg = datetime;
    out.DeviceDatetime = datetime;
    out.DeviceTimestamp = datetime;

    // =========================
    // 数値項目
    // =========================
    out.AvgActualTemp = toNumber(item.AvgActualTemp);
    out.AvgActualHumidity = toNumber(item.AvgActualHumidity);
    out.AvgActivePower = toNumber(item.AvgActivePower);
    out.SumCumulativeEnergy = toNumber(item.SumCumulativeEnergy);

    // =========================
    // alias補完
    // =========================
    if (!out.DivisionAgg) out.DivisionAgg = out.Division;
    if (!out.Division) out.Division = out.DivisionAgg;

    if (!out.Device) out.Device = out.DeviceName;
    if (!out.DeviceName) out.DeviceName = out.Device;

    // デバッグ
    if (!datetime) {
      util.error(
        "Datetime missing",
        "DataError",
        { item: item }
      );
    }

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

