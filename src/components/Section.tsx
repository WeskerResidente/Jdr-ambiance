import React from "react";
import { FontAwesome5 } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  title: string;
  icon?: string;
  children: React.ReactNode;
};

export function Section({ title, icon, children }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {icon ? <FontAwesome5 name={icon as never} size={17} color={colors.gold} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22
  },
  header: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0
  }
});
