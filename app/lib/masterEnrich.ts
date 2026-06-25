/*

export type MasterLikeRow = Record<string, unknown>;

export type MasterMaps = {
  deviceNameMap?: Map<string, string>;
  divisionNameMap?: Map<string, string>;
};

export type BuildDeviceMapSource = {
  Device?: string | null;
  DeviceName?: string | null;
};

export type BuildDivisionMapSource = {
  Division?: string | null;
  DivisionName?: string | null;
};

function isNilLike(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function toTrimmedString(v: unknown): string {
  return String(v ?? "").trim();
}


export function buildDeviceNameMap<T extends BuildDeviceMapSource>(
  devices: T[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const d of devices || []) {
    const code = toTrimmedString(d.Device);
    const name = toTrimmedString(d.DeviceName);

    if (code && name) {
      map.set(code, name);
    }
  }

  return map;
}


export function buildDivisionNameMap<T extends BuildDivisionMapSource>(
  divisions: T[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const d of divisions || []) {
    const code = toTrimmedString(d.Division);
    const name = toTrimmedString(d.DivisionName);

    if (code && name) {
      map.set(code, name);
    }
  }

  return map;
}


export function enrichWithMasterNames<T extends MasterLikeRow>(
  row: T,
  maps: MasterMaps
): T {
  const out: MasterLikeRow = { ...row };

  const deviceCode = String(out["Device"] ?? "").trim();

  if (!out["DeviceName"] && deviceCode && maps.deviceNameMap) {
    out["DeviceName"] = maps.deviceNameMap.get(deviceCode) ?? null;
  }

  const divisionCode = String(
    out["DivisionAgg"] ?? out["Division"] ?? ""
  ).trim();

  if (!out["DivisionName"] && divisionCode && maps.divisionNameMap) {
    out["DivisionName"] = maps.divisionNameMap.get(divisionCode) ?? null;
  }

  return out as T;
}

*/

export type MasterLikeRow = Record<string, unknown>;

export type MasterMaps = {
  deviceNameMap?: Map<string, string>;
  divisionNameMap?: Map<string, string>;
};

export type BuildDeviceMapSource = {
  Device?: string | null;
  DeviceName?: string | null;
};

export type BuildDivisionMapSource = {
  Division?: string | null;
  DivisionName?: string | null;
};

function isNilLike(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function toTrimmedString(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Deviceマスタから Device -> DeviceName のMapを作る
 * IotData / IotDataAgg には依存しない
 */
export function buildDeviceNameMap<T extends BuildDeviceMapSource>(
  devices: T[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const d of devices || []) {
    const code = toTrimmedString(d.Device);
    const name = toTrimmedString(d.DeviceName);

    if (code && name) {
      map.set(code, name);
    }
  }

  return map;
}

/**
 * Divisionマスタから Division -> DivisionName のMapを作る
 * IotData / IotDataAgg には依存しない
 */
export function buildDivisionNameMap<T extends BuildDivisionMapSource>(
  divisions: T[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const d of divisions || []) {
    const code = toTrimmedString(d.Division);
    const name = toTrimmedString(d.DivisionName);

    if (code && name) {
      map.set(code, name);
    }
  }

  return map;
}

/**
 * DeviceName / DivisionName をマスタMapから補完するだけの関数
 *
 * 重要:
 * - IotData / IotDataAgg 固有の処理はしない
 * - 日時列の補正もしない
 * - 数値変換もしない
 * - 集計列の補正もしない
 *
 * やること:
 * - row.Device から row.DeviceName を補完（コードと同じ場合も上書き）
 * - row.Division / DivisionAgg から row.DivisionName を補完
 */
export function enrichWithMasterNames<T extends MasterLikeRow>(
  row: T,
  maps: MasterMaps
): T {
  const out: MasterLikeRow = { ...row };

  // =========================================================
  // DeviceName 補完（★ここが今回の修正ポイント）
  // =========================================================
  const deviceCode = toTrimmedString(out["Device"]);
  const deviceNameRaw = toTrimmedString(out["DeviceName"]);

  if (
    deviceCode &&
    maps.deviceNameMap &&
    (
      isNilLike(deviceNameRaw) ||        // 空
      deviceNameRaw === deviceCode       // コードと同じ（←重要）
    )
  ) {
    out["DeviceName"] = maps.deviceNameMap.get(deviceCode) ?? null;
  }

  // =========================================================
  // DivisionName 補完（同様に強化）
  // =========================================================
  const divisionCode = toTrimmedString(
    out["DivisionAgg"] ?? out["Division"]
  );

  const divisionNameRaw = toTrimmedString(out["DivisionName"]);

  if (
    divisionCode &&
    maps.divisionNameMap &&
    (
      isNilLike(divisionNameRaw) ||      // 空
      divisionNameRaw === divisionCode   // コードと同じ
    )
  ) {
    out["DivisionName"] = maps.divisionNameMap.get(divisionCode) ?? null;
  }

  return out as T;
}

