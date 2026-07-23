// Fel7o Music — Unified Tailwind Config
// Source of truth: DESIGN.md ("Midnight Velocity" design system)
// Both Home and History screens must load this SAME file so colors never drift apart.
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface": "#0e1417",
        "surface-dim": "#0e1417",
        "surface-bright": "#333a3d",
        "surface-container-lowest": "#080f12",
        "surface-container-low": "#161d1f",
        "surface-container": "#1a2123",
        "surface-container-high": "#242b2e",
        "surface-container-highest": "#2f3639",
        "surface-variant": "#2f3639",
        "surface-tint": "#3cd7ff",

        "on-surface": "#dde3e7",
        "on-surface-variant": "#bbc9cf",
        "on-background": "#dde3e7",
        "background": "#0e1417",

        "inverse-surface": "#dde3e7",
        "inverse-on-surface": "#2b3134",
        "inverse-primary": "#00677e",

        "outline": "#859398",
        "outline-variant": "#3c494e",

        "primary": "#a8e8ff",
        "on-primary": "#003642",
        "primary-container": "#00d4ff",
        "on-primary-container": "#00586b",
        "primary-fixed": "#b4ebff",
        "primary-fixed-dim": "#3cd7ff",
        "on-primary-fixed": "#001f27",
        "on-primary-fixed-variant": "#004e5f",

        "secondary": "#d2bbff",
        "on-secondary": "#3f008e",
        "secondary-container": "#6001d1",
        "on-secondary-container": "#c9aeff",
        "secondary-fixed": "#eaddff",
        "secondary-fixed-dim": "#d2bbff",
        "on-secondary-fixed": "#25005a",
        "on-secondary-fixed-variant": "#5a00c6",

        "tertiary": "#ffd9a1",
        "on-tertiary": "#432c00",
        "tertiary-container": "#feb528",
        "on-tertiary-container": "#6c4900",
        "tertiary-fixed": "#ffdeae",
        "tertiary-fixed-dim": "#ffba3d",
        "on-tertiary-fixed": "#281900",
        "on-tertiary-fixed-variant": "#604100",

        "error": "#ffb4ab",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",

        // Brand accents used across both screens (buttons, active nav, glows)
        "accent-cyan": "#00d4ff",
        "accent-violet": "#7c3aed"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "xs": "4px",
        "sm": "8px",
        "unit": "8px",
        "md": "16px",
        "lg": "24px",
        "gutter": "24px",
        "xl": "32px",
        "margin": "32px",
        "2xl": "48px",
        "3xl": "64px"
      },
      fontFamily: {
        "display-xl": ["Inter"],
        "display-lg": ["Inter"],
        "headline-xl": ["Inter"],
        "headline-lg": ["Inter"],
        "body-lg": ["Inter"],
        "body-md": ["Inter"],
        "body-sm": ["Inter"],
        "label-md": ["Inter"],
        "caption": ["Inter"]
      },
      fontSize: {
        "display-xl": ["64px", { "lineHeight": "72px", "letterSpacing": "-0.04em", "fontWeight": "700" }],
        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.03em", "fontWeight": "700" }],
        "headline-xl": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
        "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "body-lg": ["18px", { "lineHeight": "28px", "letterSpacing": "0em", "fontWeight": "400" }],
        "body-md": ["16px", { "lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "400" }],
        "body-sm": ["14px", { "lineHeight": "20px", "letterSpacing": "0.01em", "fontWeight": "400" }],
        "label-md": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "caption": ["11px", { "lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "400" }]
      }
    }
  }
};
