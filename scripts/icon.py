"""Rasteriza o SVG oficial para os tamanhos do ícone Windows. Requer pymupdf e Pillow."""
import io
import fitz
from PIL import Image

with fitz.open('app/assets/troven-icone-cobalto.svg') as svg:
    with fitz.open('pdf', svg.convert_to_pdf()) as pdf:
        pixmap=pdf[0].get_pixmap(alpha=True)
image=Image.open(io.BytesIO(pixmap.tobytes('png'))).convert('RGBA')
image.save('app/assets/troven.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
