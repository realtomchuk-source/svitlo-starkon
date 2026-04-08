from PIL import Image, ImageOps, ImageFilter


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    img = ImageOps.grayscale(img)

    w, h = img.size
    img = img.resize((w * 2, h * 2), Image.LANCZOS)

    img = ImageOps.autocontrast(img, cutoff=2)

    img = img.filter(ImageFilter.SHARPEN)

    threshold = 140
    img = img.point(lambda p: 255 if p > threshold else 0)

    img = img.filter(ImageFilter.MedianFilter(size=3))

    return img
