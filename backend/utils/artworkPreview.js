'use strict';

const sharp = require('sharp');

const PREVIEW_MAX_DIMENSION = 1400;
const PREVIEW_JPEG_QUALITY = 82;
const MAX_INPUT_PIXELS = 80_000_000;

function watermarkSvg(width, height) {
    const fontSize = Math.max(6, Math.min(30, Math.floor(Math.min(width / 9, height * 0.075))));
    const baseline = Math.max(fontSize + 2, height - Math.max(12, fontSize * 0.55));
    return Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width - 12}" y="${baseline}" text-anchor="end" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="${Math.max(1, fontSize * 0.12)}" fill="#ffffff" fill-opacity="0.78" stroke="#000000" stroke-opacity="0.62" stroke-width="${Math.max(1, fontSize * 0.1)}" paint-order="stroke">SHOWPEICE</text></svg>`
    );
}

async function createArtworkPreview(input, { watermark = false } = {}) {
    const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
    const metadata = await source.metadata();
    if (!['jpeg', 'png'].includes(metadata.format) || !metadata.width || !metadata.height) {
        throw new Error('Artwork preview requires a PNG or JPEG image.');
    }

    const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation);
    const sourceWidth = swapsDimensions ? metadata.height : metadata.width;
    const sourceHeight = swapsDimensions ? metadata.width : metadata.height;
    const scale = Math.min(1, PREVIEW_MAX_DIMENSION / sourceWidth, PREVIEW_MAX_DIMENSION / sourceHeight);
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

    let pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
        .rotate()
        .resize({
            width: PREVIEW_MAX_DIMENSION,
            height: PREVIEW_MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .flatten({ background: '#f5f2ed' });

    if (watermark) {
        pipeline = pipeline.composite([{ input: watermarkSvg(outputWidth, outputHeight), left: 0, top: 0 }]);
    }

    return pipeline.jpeg({ quality: PREVIEW_JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

module.exports = { createArtworkPreview, PREVIEW_MAX_DIMENSION };
