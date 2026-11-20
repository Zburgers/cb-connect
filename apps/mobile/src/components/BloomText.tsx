import React from "react";
import { Text, type TextProps } from "react-native";
import { bloomType } from "../theme/typography";

/** One native Text primitive keeps font scaling and the bundled UI face consistent. */
export function BloomText({ style, allowFontScaling = true, ...props }: TextProps): React.JSX.Element {
  return <Text {...props} allowFontScaling={allowFontScaling} style={[bloomType.body, style]} />;
}
