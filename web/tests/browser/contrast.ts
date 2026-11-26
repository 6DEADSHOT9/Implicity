export async function measureContrast(element: Element, property: "color" | "borderColor" = "color") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const rgba = (color: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const composite = (source: number[], backdrop: number[], opacity: number) => {
    const alpha = source[3] / 255 * opacity;
    return source.slice(0, 3).map((channel, index) => channel * alpha + backdrop[index] * (1 - alpha));
  };
  const ancestors: Element[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
  let background = [255, 255, 255];
  let opacity = 1;
  for (const node of ancestors.reverse()) {
    const style = getComputedStyle(node);
    opacity *= Number(style.opacity);
    background = composite(rgba(style.backgroundColor), background, opacity);
  }
  const foreground = composite(rgba(getComputedStyle(element)[property]), background, opacity);
  const luminance = (rgb: number[]) => rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)];
  return { ratio: (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05), foreground, background };
}
