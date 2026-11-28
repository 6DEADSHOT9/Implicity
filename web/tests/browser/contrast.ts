type ColorProperty = "color" | "borderColor";
export type ContrastResult = { ratio: number; foreground: number[]; background: number[]; markup: string };

export function measureContrast<T extends Element | Element[]>(input: T, property: ColorProperty = "color"): T extends Element[] ? ContrastResult[] : ContrastResult {
  const measure = (element: Element): ContrastResult => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const composite = (source: number[], backdrop: number[], opacity = 1) => {
      const sourceAlpha = source[3] / 255 * opacity;
      const backdropAlpha = backdrop[3] / 255;
      const alpha = sourceAlpha + backdropAlpha * (1 - sourceAlpha);
      return alpha ? [0, 1, 2].map((index) => (source[index] * sourceAlpha + backdrop[index] * backdropAlpha * (1 - sourceAlpha)) / alpha).concat(alpha * 255) : [0, 0, 0, 0];
    };
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
    ancestors.reverse();
    const render = (includeForeground: boolean) => {
      const paint = (index: number, backdrop: number[]): number[] => {
        if (index === ancestors.length) return includeForeground ? composite(rgba(getComputedStyle(element)[property]), backdrop) : backdrop;
        const node = ancestors[index];
        const style = getComputedStyle(node);
        if (Number(style.opacity) < 1) {
          const group = paint(index + 1, composite(rgba(style.backgroundColor), [0, 0, 0, 0]));
          return composite(group, backdrop, Number(style.opacity));
        }
        return paint(index + 1, composite(rgba(style.backgroundColor), backdrop));
      };
      return paint(0, [255, 255, 255, 255]);
    };
    const background = render(false).slice(0, 3);
    const foreground = render(true).slice(0, 3);
    const luminance = (rgb: number[]) => rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const values = [luminance(foreground), luminance(background)];
    return { ratio: (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05), foreground, background, markup: element.outerHTML };
  };
  return (Array.isArray(input) ? input.map(measure) : measure(input)) as T extends Element[] ? ContrastResult[] : ContrastResult;
}
