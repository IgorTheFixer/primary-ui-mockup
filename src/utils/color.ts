import { StaveNodeType } from "./types";

export function adjustColor(color: string, amount: number) {
  return (
    "#" +
    color
      .replace(/^#/, "")
      .replace(/../g, (color) =>
        (
          "0" + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)
        ).substr(-2)
      )
  );
}

export function getStaveNodeTypeColor(staveNodeType: StaveNodeType) {
  switch (staveNodeType) {
    case StaveNodeType.User:
      return "#EEEEEE";
    case StaveNodeType.GPT:
      return "#d9f3d6";
    case StaveNodeType.TweakedGPT:
      return "#f7d0a1";
    case StaveNodeType.System:
      return "#C5E2F6";
  }
}

export function getStaveNodeTypeDarkColor(staveNodeType: StaveNodeType) {
  switch (staveNodeType) {
    case StaveNodeType.User:
      return "#A9ABAE";
    case StaveNodeType.GPT:
      return "#619F83";
    case StaveNodeType.TweakedGPT:
      return "#CB7937";
    case StaveNodeType.System:
      return "#5F8AF7";
  }
}