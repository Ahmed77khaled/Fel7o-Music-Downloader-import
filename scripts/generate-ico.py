"""
Fel7o RC1 — Multi-Resolution Windows ICO Generator
===================================================
Loads the official Fel7o brand logo, removes the dark background to produce
a transparent-background F7 mark, then generates individually-optimised PNG
frames at 9 standard Windows icon sizes and packs them into a single .ico.

Usage:
    python scripts/generate-ico.py

Requirements:
    pip install Pillow
"""

import os
import sys
import codecs
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
import struct
import io

# Force UTF-8 output on Windows to handle Arabic path names
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'replace')

# ── Paths ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_LOGO  = PROJECT_ROOT / "logo" / "Fel7o Brand Logo.png"
OUTPUT_ICO   = PROJECT_ROOT / "assets" / "icon.ico"
OUTPUT_PNG   = PROJECT_ROOT / "assets" / "logo.png"

# All required Windows icon sizes
ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]


def remove_background(img: Image.Image) -> Image.Image:
    """
    Remove the dark navy/charcoal background from the Fel7o logo,
    preserving the blue-gradient F7 glyph with smooth anti-aliased edges.

    Strategy:
      Sample the 4 corners (which are pure background) to build a palette of
      background colours across the gradient.  Then for each pixel, compute
      the minimum Euclidean RGB distance to the nearest background sample.
      Pixels close to the background palette become transparent; distant
      pixels (the bright F7 glyph) stay opaque; the transition zone gets
      smooth partial alpha for anti-aliased edges.
    """
    import numpy as np

    img = img.convert("RGBA")
    arr = np.array(img, dtype=np.float64)  # shape (H, W, 4)
    h, w = arr.shape[:2]

    # ── Build background palette from corner regions ─────────────────
    # Sample 5% of the image from each corner
    margin = max(1, int(min(h, w) * 0.05))
    corner_regions = [
        arr[:margin, :margin, :3],          # top-left
        arr[:margin, -margin:, :3],         # top-right
        arr[-margin:, :margin, :3],         # bottom-left
        arr[-margin:, -margin:, :3],        # bottom-right
        arr[:margin, w//3:2*w//3, :3],      # top-center
        arr[-margin:, w//3:2*w//3, :3],     # bottom-center
        arr[h//3:2*h//3, :margin, :3],      # left-center
        arr[h//3:2*h//3, -margin:, :3],     # right-center
    ]
    bg_samples = np.concatenate([r.reshape(-1, 3) for r in corner_regions], axis=0)

    # Subsample to ~200 representative colours for speed
    if len(bg_samples) > 200:
        indices = np.linspace(0, len(bg_samples) - 1, 200, dtype=int)
        bg_samples = bg_samples[indices]

    # ── Compute distance from each pixel to nearest bg sample ────────
    rgb = arr[:, :, :3]  # (H, W, 3)

    # Vectorised: for each pixel, find min distance to any bg sample
    # Reshape for broadcasting: rgb → (H, W, 1, 3), bg → (1, 1, N, 3)
    rgb_exp = rgb[:, :, np.newaxis, :]            # (H, W, 1, 3)
    bg_exp = bg_samples[np.newaxis, np.newaxis, :, :]  # (1, 1, N, 3)
    dists = np.sqrt(np.sum((rgb_exp - bg_exp) ** 2, axis=3))  # (H, W, N)
    min_dist = np.min(dists, axis=2)  # (H, W)

    # ── Map distance → alpha ─────────────────────────────────────────
    # Pixels within `lo` distance of background → fully transparent
    # Pixels beyond `hi` distance → fully opaque (keep original alpha)
    # Smooth ramp in between for anti-aliasing
    lo = 35.0    # below this: definitely background
    hi = 80.0    # above this: definitely foreground

    alpha_factor = np.clip((min_dist - lo) / (hi - lo), 0.0, 1.0)

    # Apply to original alpha channel
    arr[:, :, 3] = arr[:, :, 3] * alpha_factor

    result = Image.fromarray(arr.astype(np.uint8), "RGBA")
    return result


def optimise_for_size(img: Image.Image, size: int) -> Image.Image:
    """
    Resize the transparent-background logo to `size × size` with
    per-resolution optimisation.
    """
    # Use high-quality LANCZOS resampling
    resized = img.resize((size, size), Image.LANCZOS)

    # For small sizes (≤32), apply mild sharpening to keep edges crisp
    if size <= 32:
        resized = resized.filter(ImageFilter.SHARPEN)
        # Slightly boost contrast at very small sizes
        if size <= 20:
            enhancer = ImageEnhance.Contrast(resized)
            resized = enhancer.enhance(1.15)

    return resized


def build_ico(frames: list[tuple[int, Image.Image]], output_path: Path):
    """
    Build a proper multi-resolution Windows ICO file from a list of
    (size, PIL.Image) tuples.  Each frame is stored as an embedded PNG
    (the modern ICO format that Windows Vista+ supports), which preserves
    full 32-bit RGBA including smooth alpha.
    """
    num_images = len(frames)

    # ICO header: 6 bytes
    header = struct.pack("<HHH", 0, 1, num_images)  # reserved=0, type=1 (ICO), count

    # Each directory entry: 16 bytes
    # We'll build entries + data together
    dir_entries = []
    image_data_blocks = []

    # Offset starts after header + all directory entries
    data_offset = 6 + num_images * 16

    for size, img in frames:
        # Encode frame as PNG
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        png_bytes = buf.getvalue()

        # ICO directory entry
        w = size if size < 256 else 0   # 0 means 256 in ICO spec
        h = size if size < 256 else 0
        entry = struct.pack(
            "<BBBBHHII",
            w,              # width  (0 = 256)
            h,              # height (0 = 256)
            0,              # colour palette count (0 for 32-bit)
            0,              # reserved
            1,              # colour planes
            32,             # bits per pixel
            len(png_bytes), # data size
            data_offset,    # offset to data
        )
        dir_entries.append(entry)
        image_data_blocks.append(png_bytes)
        data_offset += len(png_bytes)

    # Write the ICO
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(header)
        for entry in dir_entries:
            f.write(entry)
        for block in image_data_blocks:
            f.write(block)


def main():
    if not SOURCE_LOGO.exists():
        print(f"ERROR: Source logo not found at {SOURCE_LOGO}")
        sys.exit(1)

    print(f"Loading source logo: {SOURCE_LOGO}")
    src = Image.open(SOURCE_LOGO)
    print(f"  Source size: {src.size[0]}×{src.size[1]}")

    print("Removing dark background…")
    transparent = remove_background(src)

    # Crop to the bounding box of non-transparent content, then add balanced padding
    bbox = transparent.getbbox()
    if bbox:
        cropped = transparent.crop(bbox)
        # Add ~8% padding on each side for breathing room
        cw, ch = cropped.size
        pad = int(max(cw, ch) * 0.08)
        canvas_size = max(cw, ch) + pad * 2
        padded = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        paste_x = (canvas_size - cw) // 2
        paste_y = (canvas_size - ch) // 2
        padded.paste(cropped, (paste_x, paste_y))
        transparent = padded
        print(f"  Cropped & padded to: {transparent.size[0]}×{transparent.size[1]}")

    # Save the transparent PNG for in-app use
    transparent_256 = transparent.resize((256, 256), Image.LANCZOS)
    transparent.save(OUTPUT_PNG, format="PNG", optimize=True)
    print(f"  Saved transparent logo: {OUTPUT_PNG} ({OUTPUT_PNG.stat().st_size:,} bytes)")

    # Generate all icon sizes
    print("Generating icon frames…")
    frames = []
    for size in ICON_SIZES:
        frame = optimise_for_size(transparent, size)
        frames.append((size, frame))
        print(f"  ✓ {size}×{size}")

    # Build ICO
    print(f"Building multi-resolution ICO → {OUTPUT_ICO}")
    build_ico(frames, OUTPUT_ICO)
    print(f"  ✓ ICO saved: {OUTPUT_ICO.stat().st_size:,} bytes")
    print(f"  ✓ Contains {len(ICON_SIZES)} resolutions: {', '.join(f'{s}×{s}' for s in ICON_SIZES)}")

    print("\n✅ Done — Fel7o brand icon is production-ready.")


if __name__ == "__main__":
    main()
