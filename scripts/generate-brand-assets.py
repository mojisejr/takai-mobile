"""Generate TAKAI technical derivatives from the immutable supplied mascot source.

Requires Pillow only in an external build environment; it never writes the source.
"""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/brand/takai-mascot.png'
SAND = (244, 233, 216, 255)
INK = (31, 45, 31, 255)


def background_pixel(pixel):
    red, green, blue, _ = pixel
    # The original olive backdrop is dark/muted. Subject details are retained by
    # only flood-filling matching pixels from the crop boundary.
    return red < 118 and green < 126 and blue < 104 and green >= blue and green >= red * 0.82


def remove_backdrop(image):
    image = image.convert('RGBA')
    pixels = image.load()
    width, height = image.size
    seen = set()
    queue = deque()

    for x in range(width):
        queue.append((x, 0)); queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y)); queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        seen.add((x, y))
        if not background_pixel(pixels[x, y]):
            continue
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return image


def fit_center(image, size, content_size):
    image.thumbnail((content_size, content_size), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


source = Image.open(SOURCE).convert('RGBA')
# Hat, face, and upper-shirt are intentionally kept; full torso is not an icon.
crop = source.crop((0, 230, 1024, 1190))
foreground = fit_center(remove_backdrop(crop), 1024, 700)

foreground.save(ROOT / 'assets/android-icon-foreground.png')
Image.new('RGB', (1024, 1024), SAND[:3]).save(ROOT / 'assets/android-icon-background.png')

icon = Image.new('RGBA', (1024, 1024), SAND)
icon.alpha_composite(foreground)
icon.convert('RGB').save(ROOT / 'assets/icon.png')

mask = foreground.getchannel('A')
mono = Image.new('RGBA', (1024, 1024), INK)
mono.putalpha(mask)
mono.save(ROOT / 'assets/android-icon-monochrome.png')

fit_center(foreground, 1024, 400).save(ROOT / 'assets/splash-icon.png')
fit_center(foreground, 256, 256).save(ROOT / 'assets/brand/takai-mascot-bust.png')
icon.convert('RGBA').resize((48, 48), Image.Resampling.LANCZOS).save(ROOT / 'assets/favicon.png')

print('TAKAI_BRAND_ASSETS_GENERATED')
