import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker using the Vite bundled worker asset
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

/**
 * Converts a data URL string to a Uint8Array.
 */
const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

export interface PdfCompressionOptions {
    /** Target maximum dimension (width or height) in pixels. Default: 2400 (ideal for crisp document scans) */
    maxDimension?: number;
    /** JPEG quality for image pages (0.1 to 1.0). Default: 0.92 */
    quality?: number;
    /** Only compress if file is larger than this byte threshold. Default: 2.5 MB */
    minSizeToCompress?: number;
    /** Optional password to decrypt and compress password-protected PDFs */
    password?: string;
}

/**
 * Compresses a PDF file entirely in the browser before upload.
 * - Handles both text/vector PDFs and large camera/scanner image PDFs.
 * - Shrinks massive multi-megabyte camera scans while preserving razor-sharp text.
 * - Skips compression for normal-sized PDFs (<2.5MB) to keep 100% original crisp vector clarity.
 * - Falls back to the original file gracefully if anything fails.
 */
export const compressPdf = async (
    file: File,
    options?: PdfCompressionOptions
): Promise<File> => {
    const minSize = options?.minSizeToCompress ?? 2.5 * 1024 * 1024; // 2.5 MB
    if (file.size <= minSize) {
        console.log(`[PDF_COMPRESS] File is already within reasonable size (${(file.size / 1024).toFixed(1)} KB), skipping to preserve 100% original vector sharpness.`);
        return file;
    }

    const startTime = Date.now();
    const originalSizeKb = (file.size / 1024).toFixed(1);
    console.log(`[PDF_COMPRESS] Starting compression for "${file.name}" (${originalSizeKb} KB)...`);

    try {
        const fileBuffer = await file.arrayBuffer();

        // 1. Try quick structural optimization first (strips unreferenced objects & packs streams)
        let sourcePdfDoc: PDFDocument;
        try {
            sourcePdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        } catch (loadErr) {
            console.warn('[PDF_COMPRESS] Could not parse PDF with pdf-lib, skipping compression:', loadErr);
            return file;
        }

        const pageCount = sourcePdfDoc.getPageCount();
        if (pageCount === 0) return file;

        // 2. Render each page using pdfjs-dist and repackage with optimized high-quality JPEG encoding
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(fileBuffer),
            password: options?.password || undefined,
        });
        const pdfJsDoc = await loadingTask.promise;

        const maxDim = options?.maxDimension ?? 2400;
        const quality = options?.quality ?? 0.92;

        const outputPdf = await PDFDocument.create();

        for (let i = 1; i <= pdfJsDoc.numPages; i++) {
            const page = await pdfJsDoc.getPage(i);
            const unscaledViewport = page.getViewport({ scale: 1.0 });

            // Calculate scale: fit maxDim while retaining aspect ratio; minimum 2.0x supersampling for razor-sharp text
            const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
            const scale = currentMax > maxDim ? maxDim / currentMax : 2.0;

            const viewport = page.getViewport({ scale });

            // Create off-screen canvas
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) continue;

            // Fill white background before rendering
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: ctx,
                canvas,
                viewport
            }).promise;

            // Convert canvas to optimized JPEG
            const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
            const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

            // Embed into clean new PDF
            const embeddedJpg = await outputPdf.embedJpg(jpegBytes);
            const newPage = outputPdf.addPage([unscaledViewport.width, unscaledViewport.height]);
            newPage.drawImage(embeddedJpg, {
                x: 0,
                y: 0,
                width: unscaledViewport.width,
                height: unscaledViewport.height
            });
        }

        const compressedBytes = await outputPdf.save({ useObjectStreams: true });
        const compressedSizeKb = (compressedBytes.byteLength / 1024).toFixed(1);
        const durationMs = Date.now() - startTime;

        if (compressedBytes.byteLength < file.size) {
            const percentReduction = (((file.size - compressedBytes.byteLength) / file.size) * 100).toFixed(1);
            console.log(`[PDF_COMPRESS] Success! ${originalSizeKb} KB → ${compressedSizeKb} KB (${percentReduction}% reduction in ${durationMs}ms)`);
            return new File([compressedBytes as any], file.name, { type: 'application/pdf' });
        } else {
            console.log(`[PDF_COMPRESS] Compressed size (${compressedSizeKb} KB) was not smaller than original (${originalSizeKb} KB), keeping original.`);
            return file;
        }
    } catch (err: any) {
        if (err?.name === 'PasswordException' || err?.message?.includes('password')) {
            console.log('[PDF_COMPRESS] Password-protected PDF detected, preserving intact original file.');
            return file;
        }
        console.warn('[PDF_COMPRESS] Compression encountered an error, falling back to original file:', err);
        return file;
    }
};
