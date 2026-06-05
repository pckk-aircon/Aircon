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
  const nextToken = ctx.args.nextToken ?? null;

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
    nextToken,
  };
}

export function response(ctx) {
  const items = (ctx.result?.items ?? []).map((item) => {
    const out = { ...item };

    // =========================
    // 日時変換（超重要）
    // =========================
    const toIso = (v) => {
      if (typeof v !== "string") return null;

      let s = v.trim();
      if (!s) return null;

      // "2026-05-11 00:00:00" → "2026-05-11T00:00:00"
      if (s.includes(" ") && !s.includes("T")) {
        s = s.replace(" ", "T");
      }

      // タイムゾーン補完
      if (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) &&
        !/[+\-]\d{2}:\d{2}$/.test(s)
      ) {
        s += "+09:00";
      }

      return s;
    };

    // =========================
    // 数値変換
    // =========================
    const toNumber = (v) => {
      if (v == null) return null;
      if (typeof v === "number") return v;

      if (typeof v === "string") {
        const n = Number(v.replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      }

      return null;
    };

    // =========================
    // ✅ 時刻生成（最重要）
    // =========================
    const datetime = toIso(item.DatetimeAgg ?? item.AggKey);

    out.DatetimeAgg = datetime;
    out.AggKey = toIso(item.AggKey);

    // frontendで使う列も揃える
    out.DeviceDatetime = datetime;
    out.DeviceTimestamp = datetime;

    // =========================
    // ✅ 数値項目
    // =========================
    out.AvgActualTemp = toNumber(item.AvgActualTemp);
    out.AvgActualHumidity = toNumber(item.AvgActualHumidity);
    out.AvgActivePower = toNumber(item.AvgActivePower);
    out.SumCumulativeEnergy = toNumber(item.SumCumulativeEnergy);

    // =========================
    // ✅ 正規化（frontend用）
    // =========================
    if (out.AvgActualTemp != null && out.ActualTemp == null) {
      out.ActualTemp = out.AvgActualTemp;
    }

    if (out.AvgActualHumidity != null && out.ActualHumidity == null) {
      out.ActualHumidity = out.AvgActualHumidity;
    }

    if (out.AvgActivePower != null && out.ActivePower == null) {
      out.ActivePower = out.AvgActivePower;
    }

    if (out.SumCumulativeEnergy != null && out.CumulativeEnergy == null) {
      out.CumulativeEnergy = out.SumCumulativeEnergy;
    }

    // =========================
    // ✅ alias補完
    // =========================
    if (!out.DivisionAgg) out.DivisionAgg = out.Division;
    if (!out.Division) out.Division = out.DivisionAgg;

    if (!out.Device) out.Device = out.DeviceName;
    if (!out.DeviceName) out.DeviceName = out.Device;

    // =========================
    // デバッグ（必要なら）
    // =========================
    if (!datetime) {
      console.warn("⚠️ datetime missing in resolver", {
        AggKey: item.AggKey,
        DatetimeAgg: item.DatetimeAgg,
        raw: item,
      });
    }

    return out;
  });

  return {
    items,
    nextToken: ctx.result?.nextToken ?? null,
  };
}

