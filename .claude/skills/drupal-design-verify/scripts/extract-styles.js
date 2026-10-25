/**
 * @file
 * Probe function for browser_evaluate — extracts every design-relevant computed
 * value from a rendered component in one pass.
 *
 * Paste the body of this file as the `function` argument to
 * mcp__plugin_playwright_playwright__browser_evaluate, replacing ROOT_SELECTOR
 * with the component's root class (e.g. '.example-split-card').
 *
 * Why one pass: each browser_evaluate round trip costs a tool call, and the
 * layers of the audit need overlapping data. Extracting everything once and
 * analysing the JSON afterwards keeps a full verification to a single call per
 * breakpoint.
 *
 * Returns { found: false, ... } rather than throwing when the component is
 * absent — an unrendered component must be reported, never silently passed.
 */

() => {
  const ROOT = 'ROOT_SELECTOR';
  const root = document.querySelector(ROOT);

  // Elements that extend past their parent's inner content edge by design — a
  // decorative layer or a full-bleed panel. Measuring them as overflow reports a
  // defect on every run. Real horizontal overflow is document scrollWidth.
  const EXPECTED_BLEED = ['__pattern', '__panel', '__bleed'];

  if (!root) {
    return {
      found: false,
      selector: ROOT,
      hint: [...document.querySelectorAll('[class*="example-"]')]
        .map((n) => n.className)
        .slice(0, 15),
    };
  }

  // Properties worth comparing to a design. Deliberately excludes inherited
  // noise (cursor, text-rendering) that would bury real findings.
  const PROPS = [
    'color',
    'backgroundColor',
    'backgroundImage',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'borderRadius',
    'borderColor',
    'borderWidth',
    'padding',
    'margin',
    'gap',
    'display',
    'flexDirection',
    'flexWrap',
    'gridTemplateColumns',
    'alignItems',
    'justifyContent',
    'boxShadow',
    'opacity',
  ];

  const round = (n) => Math.round(n * 10) / 10;

  const describe = (node) => {
    const cs = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const style = {};
    PROPS.forEach((p) => {
      const v = cs[p];
      // 'none'/'normal'/'auto' are defaults that say nothing about the design.
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') {
        style[p] = v;
      }
    });
    // A zero-width border still reports a color. Keeping it would flood the
    // palette with colors nobody can see and bury the real off-token values.
    if (parseFloat(cs.borderWidth) === 0) {
      delete style.borderColor;
      delete style.borderWidth;
    }
    const named = [...node.classList].filter(
      (c) => c.startsWith('example-') || c === 'btn',
    );
    return {
      selector: named.length ? '.' + named.join('.') : node.tagName.toLowerCase(),
      tag: node.tagName.toLowerCase(),
      text: (node.textContent || '').trim().slice(0, 40),
      box: {
        w: round(rect.width),
        h: round(rect.height),
        x: round(rect.x),
        y: round(rect.y),
      },
      style,
    };
  };

  // Walk every element carrying a BEM class belonging to this component, plus
  // buttons and images. Elements without an example- class are layout plumbing and
  // have no counterpart in the design.
  const prefix = ROOT.replace(/^\./, '');
  const nodes = [root, ...root.querySelectorAll('*')].filter((n) => {
    if (n === root) return true;
    const cls = [...n.classList];
    return (
      cls.some((c) => c.startsWith(prefix)) ||
      cls.includes('btn') ||
      n.tagName === 'IMG' ||
      /^H[1-6]$/.test(n.tagName)
    );
  });

  const elements = nodes.map(describe);

  // Distinct painted values — the input to the token-conformance layer.
  const palette = {};
  const typeScale = {};
  const radii = {};
  elements.forEach((el) => {
    const s = el.style;
    [s.color, s.backgroundColor, s.borderColor].forEach((c) => {
      if (c && c !== 'rgba(0, 0, 0, 0)') {
        palette[c] = (palette[c] || 0) + 1;
      }
    });
    if (s.fontSize) {
      const key = `${s.fontSize}/${s.lineHeight || '?'} ${s.fontWeight || ''} ${
        s.fontFamily ? s.fontFamily.split(',')[0] : ''
      }`.trim();
      typeScale[key] = (typeScale[key] || 0) + 1;
    }
    if (s.borderRadius) radii[s.borderRadius] = (radii[s.borderRadius] || 0) + 1;
  });

  // A declaration can name the right family and still paint fallback glyphs.
  // Comparing fontFamily strings cannot see this — the computed value reports what
  // was asked for, not what rendered. document.fonts.check() is no use either: it
  // returns true for unloaded families because it counts fallback as paintable.
  // Measuring width against a family that certainly does not exist does work.
  const probeWidth = (family) => {
    const s = document.createElement('span');
    s.textContent = 'The quick brown fox jumps over the lazy dog';
    s.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;' +
      `font:400 18px ${family}`;
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const control = probeWidth('__NoSuchFont__, sans-serif');
  const fonts = {};
  ['Roboto', 'SourceSansPro', 'SourceSansProBold'].forEach((f) => {
    fonts[f] = probeWidth(`${f}, sans-serif`) !== control;
  });

  // Document-level scroll is the only overflow a user can actually see; `worst`
  // lists children escaping the box that is supposed to hold them, as leads.
  //
  // Measure against the narrowest ancestor that actually constrains content, not
  // against the root. every component roots in a full-bleed <section> whose
  // content edge is the viewport edge — nothing can exceed it, so measuring there
  // makes `worst` permanently empty and the check useless.
  const contentBox = (el) => {
    const r = el.getBoundingClientRect();
    return r.right - parseFloat(getComputedStyle(el).paddingRight || 0);
  };
  const constrainer =
    root.querySelector('.container') ||
    root.querySelector('[class*="__panel"], [class*="__inner"]') ||
    root;
  const contentRight = contentBox(constrainer);

  const worst = [...constrainer.querySelectorAll('*')]
    .filter((n) => {
      const cls = [...n.classList];
      // The bleed elements are the ones deliberately drawn outside the content
      // box — a decorative layer, or a panel that spans wider than its wrapper.
      return !EXPECTED_BLEED.some((b) => cls.some((c) => c.includes(b)));
    })
    .map((n) => ({
      selector: [...n.classList].find((c) => c.startsWith('example-')) || n.tagName,
      over: round(n.getBoundingClientRect().right - contentRight),
    }))
    .filter((x) => x.over > 0.5)
    .sort((a, b) => b.over - a.over)
    .slice(0, 5);

  return {
    found: true,
    selector: ROOT,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    rootBox: describe(root).box,
    elementCount: elements.length,
    elements,
    distinct: { palette, typeScale, radii },
    fonts,
    overflow: {
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Named so an empty `worst` can be read as "nothing escaped this box"
      // rather than "measured against something nothing could escape".
      measuredAgainst:
        [...constrainer.classList].find((c) => c.startsWith('example-') || c === 'container') ||
        constrainer.tagName,
      worst,
    },
  };
};
