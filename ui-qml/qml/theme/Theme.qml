pragma Singleton
import QtQuick

/* ===========================================================================
   Misuc Neu — Theme singleton (Qt/QML port of the web design tokens)
   Neumorphism: the background IS the surface; depth comes from a paired
   dark (bottom-right) + light (top-left) soft shadow, never borders.
   Two palettes (light/dark) x accent set, mirroring css/tokens.css and the
   Qt Widgets ThemeEngine presets (violet / cyan / emerald / amber / crimson).
   =========================================================================== */
QtObject {
    id: theme

    // ---- mode ----
    property bool dark: true
    property string accentName: "violet"

    // ---- geometry ----
    readonly property int radiusXs: 6
    readonly property int radiusSm: 10
    readonly property int radiusMd: 14
    readonly property int radiusLg: 20
    readonly property int radiusXl: 26
    readonly property int radiusPill: 999

    // ---- shadow distances / blur ----
    readonly property int d1: 3
    readonly property int d2: 6
    readonly property int d3: 10
    readonly property real blur1: 6
    readonly property real blur2: 12
    readonly property real blur3: 22

    // ---- motion ----
    readonly property int tFast: 120
    readonly property int tMed: 220

    // ---- accent palette ----
    readonly property var accents: ({
        "violet":  { c: "#8f7bfa", deep: "#6c5ce7" },
        "cyan":    { c: "#22d3ee", deep: "#0e9fbb" },
        "emerald": { c: "#34d399", deep: "#1ba876" },
        "amber":   { c: "#ffb454", deep: "#d98a1f" },
        "crimson": { c: "#ff5470", deep: "#d83552" }
    })
    readonly property color accent: accents[accentName].c
    readonly property color accentDeep: accents[accentName].deep
    readonly property color accentInk: "#ffffff"
    readonly property color accentSoft: Qt.rgba(accent.r, accent.g, accent.b, 0.30)

    // ---- semantic state colours ----
    readonly property color ok:      dark ? "#4ade80" : "#2fae66"
    readonly property color warn:    "#e6a23c"
    readonly property color danger:  dark ? "#ff5c5c" : "#e05252"

    // ---- surfaces & shadows (theme-dependent) ----
    readonly property color bg:         dark ? "#1c2027" : "#e7ebf2"
    readonly property color bgDeep:     dark ? "#171a20" : "#dfe4ec"
    readonly property color surface:    dark ? "#1c2027" : "#e7ebf2"
    readonly property color surfaceHi:  dark ? "#21262e" : "#eef1f6"
    readonly property color shDark:     dark ? "#12141a" : "#bcc5d3"
    readonly property color shLight:    dark ? "#282d37" : "#ffffff"

    readonly property color text:       dark ? "#dfe3ea" : "#39414f"
    readonly property color textStrong: dark ? "#f4f6f9" : "#232a36"
    readonly property color textDim:    dark ? "#949dad" : "#7c8798"
    readonly property color textFaint:  dark ? "#69707e" : "#a3adbd"

    readonly property color gridLine:   dark ? "#242a33" : "#d5dbe5"
    readonly property color gridLine2:  dark ? "#2f3742" : "#c6cede"
    readonly property color laneAlt:    dark ? "#20242c" : "#eef1f6"

    readonly property color stepOff:    dark ? "#232833" : "#dde2ea"
    readonly property color ledOff:     dark ? "#333a46" : "#cfd6e0"

    // ---- helpers ----
    function withAlpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a); }

    // Shadow colours for neumorphic surfaces. `raised` pushes dark down-right
    // and light up-left; `inset` reverses them.
    function shadowDark(raised)  { return raised ? shDark  : shLight; }
    function shadowLight(raised) { return raised ? shLight : shDark; }

    function toggle() { dark = !dark; }
}
