import type {
  PlayerSettings,
  PlayerSettingsBind,
  PlayerSettingsMouse,
} from "../model/index.js";

interface RawActionMapping {
  actionName?: string;
  name?: string;
  command?: string;
  key?: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  characterName?: string;
  bindIndex?: number;
}

interface RawSettingItem {
  settingEnum?: string;
  name?: string;
  value?: unknown;
}

export class PlayerSettingsBuilder {
  static build(data: Record<string, unknown>): PlayerSettings {
    const rawMappings = (
      Array.isArray(data.actionMappings) ? data.actionMappings : []
    ) as RawActionMapping[];

    const binds: PlayerSettingsBind[] = rawMappings.map((m) => ({
      command: String(m.actionName ?? m.name ?? m.command ?? ""),
      key: String(m.key ?? ""),
      alt: Boolean(m.alt),
      ctrl: Boolean(m.ctrl),
      shift: Boolean(m.shift),
      agent: m.characterName && m.characterName !== "None" ? String(m.characterName) : null,
      slot: typeof m.bindIndex === "number" ? m.bindIndex : 0,
    }));

    const mouse = this.extractMouse(data);

    return {
      binds,
      mouse,
      raw: data,
    };
  }

  private static extractMouse(data: Record<string, unknown>): PlayerSettingsMouse {
    const floatList = (
      Array.isArray(data.floatSettings) ? data.floatSettings : []
    ) as RawSettingItem[];
    const boolList = (
      Array.isArray(data.boolSettings) ? data.boolSettings : []
    ) as RawSettingItem[];

    const findFloat = (pattern: RegExp): number | null => {
      const item = floatList.find((s) => pattern.test(s.settingEnum ?? s.name ?? ""));
      return typeof item?.value === "number" ? item.value : null;
    };

    const findBool = (pattern: RegExp): boolean | null => {
      const item = boolList.find((s) => pattern.test(s.settingEnum ?? s.name ?? ""));
      return typeof item?.value === "boolean" ? item.value : null;
    };

    return {
      sensitivity: findFloat(/Sensitivity$/i) ?? findFloat(/MouseSensitivity/i),
      scopedSensitivityMultiplier:
        findFloat(/ZoomMultiplier/i) ??
        findFloat(/TargetingMultiplier/i) ??
        findFloat(/Scoped/i),
      invertY: findBool(/InvertMouse/i) ?? findBool(/Invert.*Axis/i),
      rawInputBuffer: findBool(/RawInput/i),
    };
  }
}
