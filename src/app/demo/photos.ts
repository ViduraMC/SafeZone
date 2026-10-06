/** Generates a lightweight SVG "photo" so the demo has evidence images without binary assets. */
export function placeholderPhoto(caption: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="hsl(${hue},45%,70%)"/><stop offset="1" stop-color="hsl(${hue},40%,32%)"/></linearGradient></defs>
<rect width="640" height="400" fill="url(#g)"/>
<path d="M0 290 Q160 250 320 285 T640 270 V400 H0Z" fill="hsl(${hue + 20},35%,28%)" opacity=".85"/>
<rect x="70" y="170" width="120" height="110" fill="hsl(30,20%,85%)" opacity=".9"/><polygon points="60,175 130,120 200,175" fill="hsl(10,35%,40%)"/>
<rect x="430" y="150" width="140" height="130" fill="hsl(40,15%,80%)" opacity=".9"/>
<text x="24" y="380" font-family="sans-serif" font-size="22" fill="#fff">${caption.replace(/[<&>]/g, '')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
