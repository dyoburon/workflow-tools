#!/usr/bin/env python3
"""Generate Chrome extension icons for DOM Extractor"""

from PIL import Image, ImageDraw

def create_icon(size):
    """Create a crosshair/target icon for DOM selection - simplified for small sizes"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Colors
    primary = (66, 133, 244, 255)      # Google Blue
    secondary = (52, 168, 83, 255)     # Green accent

    center = size // 2
    padding = max(2, size // 8)

    if size <= 16:
        # Super simplified for 16x16: just a rounded square with center dot
        line_width = 2
        draw.rounded_rectangle(
            [padding, padding, size - padding - 1, size - padding - 1],
            radius=2,
            outline=primary,
            width=line_width
        )
        # Center dot
        dot_r = 2
        draw.ellipse([(center - dot_r, center - dot_r),
                      (center + dot_r, center + dot_r)],
                     fill=secondary)
    else:
        # Full design for 48x48 and 128x128
        line_width = max(2, size // 16)
        corner_length = size // 4
        radius = max(2, size // 8)

        # Rounded rectangle border
        draw.rounded_rectangle(
            [padding, padding, size - padding - 1, size - padding - 1],
            radius=radius,
            outline=primary,
            width=line_width
        )

        # Corner brackets
        bracket_width = line_width + 1

        # Top-left
        draw.line([(padding, padding + corner_length),
                   (padding, padding),
                   (padding + corner_length, padding)],
                  fill=secondary, width=bracket_width)

        # Top-right
        draw.line([(size - padding - corner_length - 1, padding),
                   (size - padding - 1, padding),
                   (size - padding - 1, padding + corner_length)],
                  fill=secondary, width=bracket_width)

        # Bottom-left
        draw.line([(padding, size - padding - corner_length - 1),
                   (padding, size - padding - 1),
                   (padding + corner_length, size - padding - 1)],
                  fill=secondary, width=bracket_width)

        # Bottom-right
        draw.line([(size - padding - corner_length - 1, size - padding - 1),
                   (size - padding - 1, size - padding - 1),
                   (size - padding - 1, size - padding - corner_length - 1)],
                  fill=secondary, width=bracket_width)

        # Crosshair
        crosshair_size = size // 5
        crosshair_gap = max(3, size // 10)

        draw.line([(center - crosshair_size, center), (center - crosshair_gap, center)],
                  fill=primary, width=line_width)
        draw.line([(center + crosshair_gap, center), (center + crosshair_size, center)],
                  fill=primary, width=line_width)
        draw.line([(center, center - crosshair_size), (center, center - crosshair_gap)],
                  fill=primary, width=line_width)
        draw.line([(center, center + crosshair_gap), (center, center + crosshair_size)],
                  fill=primary, width=line_width)

        # Center dot
        dot_radius = max(2, size // 20)
        draw.ellipse([(center - dot_radius, center - dot_radius),
                      (center + dot_radius, center + dot_radius)],
                     fill=secondary)

    return img


def main():
    sizes = [16, 48, 128]

    for size in sizes:
        icon = create_icon(size)
        filename = f"icons/icon{size}.png"
        icon.save(filename)
        print(f"Created {filename}")

    print("\nAll icons generated!")


if __name__ == "__main__":
    main()
