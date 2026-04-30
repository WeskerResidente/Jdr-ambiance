import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "./AppButton";
import { colors } from "../theme/colors";

type Props = {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
};

export function VolumeStepper({ label, value, onChange }: Props) {
  const percent = Math.round(value * 100);

  function update(delta: number) {
    onChange(Math.max(0, Math.min(1, value + delta)));
  }

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.meter}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>
      <Text style={styles.percent}>{percent}%</Text>
      <View style={styles.buttons}>
        <AppButton compact icon="minus" label="" onPress={() => update(-0.1)} style={styles.iconButton} />
        <AppButton compact icon="plus" label="" onPress={() => update(0.1)} style={styles.iconButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8
  },
  copy: {
    flex: 1,
    gap: 7
  },
  label: {
    color: colors.text,
    fontWeight: "700",
    letterSpacing: 0
  },
  meter: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft
  },
  fill: {
    height: "100%",
    backgroundColor: colors.gold
  },
  percent: {
    width: 44,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
    textAlign: "right"
  },
  buttons: {
    flexDirection: "row",
    gap: 6
  },
  iconButton: {
    width: 38,
    paddingHorizontal: 0
  }
});
