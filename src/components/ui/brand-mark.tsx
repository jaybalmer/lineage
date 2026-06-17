// Linestry brand mark. Interlocking b/l monogram with a center dot.
//
// Treatment (June 2026): the mark is tilted 30 degrees to the left (counter
// clockwise) as its canonical form, matching Cory's banner and icon set. The
// body is brand blue. The center dot is a CONTRAST dot, not blue: it takes
// var(--foreground) so it reads ink on light surfaces and near-white on dark.
// Pass dotColor to override (e.g. "#ffffff" for a next/og dark card). Pass
// knockout to punch a true transparent hole instead of a solid dot. Pass
// tilt={false} for an upright mark in the rare context that needs it.
//
// The viewBox is cropped to the tilted ink bounds (217 317 592 390), so the
// mark fills its box edge to edge rather than floating in padding. Size it
// smaller than its tile if you want a safe margin (favicon can fill; an app
// icon tile should leave a little air). In a lockup, size the mark so its
// ink height equals the wordmark height, cap to descender. See the Brand
// Guide (Brand Guide/linestry-visual-guide.html) for the canonical spec.
//
// The path strings below are the single source of truth for the mark.
// brandMarkSvgString() reuses them to build a standalone SVG for next/og
// routes (favicon, apple icon, opengraph), which cannot render React.
import * as React from "react";

export const BRAND_BLUE = "#3b82f6";
export const BRAND_INK = "#161413";
export const MARK_TILT = "rotate(-30 512 512)";

export const BRAND_MARK_BODY_PATHS = [
  "M516.907227,653.126831 C486.950073,660.074890 456.987152,662.447754 426.734894,661.103638 C409.790588,660.350708 392.856079,659.369629 376.255035,655.300964 C350.599731,649.013306 336.738190,634.144409 332.647217,608.094727 C331.222778,599.024597 330.734894,589.894958 330.737823,580.719482 C330.764252,497.555573 330.770325,414.391663 330.753143,331.227753 C330.751099,321.343597 331.642456,322.281433 321.998260,322.233826 C317.831879,322.213287 313.662506,322.133484 309.499634,322.255615 C306.199432,322.352386 304.618683,321.183807 304.656952,317.637695 C304.777344,306.472748 304.780914,295.304657 304.641815,284.140106 C304.603180,281.038452 305.933228,279.658447 308.753174,278.929688 C325.194031,274.680878 341.848114,271.578766 358.720642,269.730377 C369.785828,268.518188 380.815674,267.064148 392.047028,268.318909 C414.589203,270.837250 423.609283,282.794434 424.225830,305.836395 C426.004578,372.311310 424.504364,438.807343 424.957825,505.293030 C425.085083,523.957275 425.075012,542.622742 425.298889,561.285583 C425.344482,565.083435 425.808807,568.954712 426.682953,572.649475 C429.334412,583.856506 436.690735,590.234253 447.809296,592.782104 C460.332031,595.651672 473.031891,595.345337 485.632172,594.536621 C506.733795,593.182495 527.740173,590.743164 548.368530,585.758667 C557.449829,583.564331 566.330627,580.807312 574.960571,577.225464 C576.436707,576.612732 577.815186,575.382202 579.612610,576.076050 C580.736450,576.918274 580.691650,578.099670 580.644592,579.267395 C580.087524,593.081299 579.407776,606.891724 579.027100,620.710449 C578.895203,625.499878 577.251465,628.613892 572.894836,631.074646 C555.360657,640.978210 536.776489,648.090149 516.907227,653.126831 z",
  "M595.047241,443.009827 C588.592163,434.658752 579.608887,432.465363 570.191406,431.249939 C554.203308,429.186554 538.261108,430.523956 522.372742,432.290039 C502.681976,434.478851 483.018707,437.011108 464.083374,443.241119 C459.192047,444.850494 454.380920,446.745972 449.645630,448.773224 C446.181580,450.256195 444.962646,449.080139 445.111053,445.667938 C445.747925,431.026642 446.465118,416.388458 447.003296,401.743622 C447.117218,398.643402 448.664062,396.936523 451.098969,395.450287 C465.266815,386.802368 480.427246,380.384766 496.290558,375.688629 C527.203979,366.537079 558.904114,363.183777 591.028748,364.065002 C610.302246,364.593719 629.603333,365.338165 648.530579,369.781281 C671.175232,375.097015 687.041748,387.422424 692.126953,411.166687 C694.331970,421.462250 695.160034,431.918030 695.165344,442.405029 C695.208069,526.558838 695.158325,610.712646 695.131836,694.866455 C695.129333,702.920410 695.113464,702.919861 703.410461,702.933228 C707.409851,702.939636 711.419312,703.129089 715.405823,702.906433 C719.588562,702.672974 721.454468,704.036011 721.351562,708.555298 C721.109009,719.214844 721.174011,729.884949 721.327393,740.547791 C721.376282,743.943542 720.212463,745.726135 716.854065,746.563965 C701.667358,750.352600 686.303711,753.226562 670.796631,755.215454 C660.411499,756.547485 649.985291,757.693237 639.452942,757.383118 C635.427612,757.264587 631.461731,756.912781 627.573120,756.025269 C609.405090,751.878479 603.898804,741.124634 601.717896,723.708923 C600.597534,714.761963 600.862976,705.751099 600.858276,696.755920 C600.817871,619.601318 600.786194,542.446655 600.670593,465.292175 C600.659058,457.586639 599.596069,450.008698 595.047241,443.009827 z",
];

export const BRAND_MARK_DOT_PATH =
  "M478.596985,545.418701 C462.670105,529.262451 459.123566,507.409088 469.098694,488.190796 C478.739166,469.617401 498.891815,459.745819 520.291016,463.114746 C537.970947,465.898163 553.996338,480.613678 558.259827,498.660309 C563.063599,518.993713 556.901978,535.903198 540.620850,548.755737 C522.153625,563.334106 496.991119,561.856323 478.596985,545.418701 z";

// Cropped to the tilted ink bounds so the mark fills its box. The paths and
// the rotate center (512,512) still live in the original 1024 coordinate space.
const VIEWBOX = "217 317 592 390";

/**
 * A standalone SVG document string for the mark. `color` fills the body
 * (brand blue by default). The center dot uses `dotColor` (brand ink by
 * default; pass "#ffffff" on a dark ground). Pass knockout=true for a true
 * transparent hole. Pass tilt=false for an upright mark. Used as a data-URI
 * image source inside next/og ImageResponse routes, where resvg rasterizes it.
 */
export function brandMarkSvgString(
  color: string = BRAND_BLUE,
  dotColor: string = BRAND_INK,
  knockout: boolean = false,
  tilt: boolean = true,
): string {
  const open = tilt ? `<g transform="${MARK_TILT}">` : "<g>";
  const body = BRAND_MARK_BODY_PATHS.map((d) => `<path fill="${color}" d="${d}"/>`).join("");
  if (knockout) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}"><defs><mask id="ls-dot" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect x="0" y="0" width="1024" height="1024" fill="white"/><path fill="black" d="${BRAND_MARK_DOT_PATH}"/></mask></defs>${open}<g mask="url(#ls-dot)">${body}</g></g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${open}${body}<path fill="${dotColor}" d="${BRAND_MARK_DOT_PATH}"/></g></svg>`;
}

export function BrandMark({
  size = 24,
  color = BRAND_BLUE,
  dotColor = "var(--foreground)",
  knockout = false,
  tilt = true,
  title = "Linestry",
  ...props
}: {
  size?: number;
  color?: string;
  dotColor?: string;
  knockout?: boolean;
  tilt?: boolean;
  title?: string;
} & React.SVGProps<SVGSVGElement>) {
  const maskId = React.useId();
  const transform = tilt ? MARK_TILT : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEWBOX}
      role="img"
      aria-label={title}
      {...props}
    >
      {knockout ? (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={1024} height={1024}>
            <rect x="0" y="0" width={1024} height={1024} fill="white" />
            <path d={BRAND_MARK_DOT_PATH} fill="black" />
          </mask>
          <g transform={transform} mask={`url(#${maskId})`}>
            {BRAND_MARK_BODY_PATHS.map((d, i) => (
              <path key={i} d={d} fill={color} />
            ))}
          </g>
        </>
      ) : (
        <g transform={transform}>
          {BRAND_MARK_BODY_PATHS.map((d, i) => (
            <path key={i} d={d} fill={color} />
          ))}
          <path d={BRAND_MARK_DOT_PATH} fill={dotColor} />
        </g>
      )}
    </svg>
  );
}

export default BrandMark;
