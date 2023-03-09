import { PDFDocument } from 'pdf-lib';
import { promises as fs } from 'fs';
import pLimit from 'p-limit';

interface PdfFile {
  filename: string;
  content: Buffer;
}

class PdfSplitter {
  private pdfFile: PdfFile | null = null;

  public async loadPdfFile(filepath: string): Promise<void> {
    try {
      const content = await fs.readFile(filepath);
      this.pdfFile = { filename: filepath, content };
    } catch (error: any) {
      console.error(`Error loading PDF file: ${error.message}`);
      throw error;
    }
  }

  public async splitPdfFile(
    pageCountPerFile: number,
    maxConcurrent: number
  ): Promise<void> {
    try {
      if (!this.pdfFile) {
        throw new Error('No PDF file loaded');
      }

      const srcDoc = await PDFDocument.load(this.pdfFile.content, {
        ignoreEncryption: true,
      });

      const pageCount = srcDoc.getPageCount();
      const numFiles = Math.ceil(pageCount / pageCountPerFile);
      const limit = pLimit(maxConcurrent);

      const promises = [];
      for (let i = 0; i < numFiles; i++) {
        const startIndex = i * pageCountPerFile;
        const endIndex = Math.min(startIndex + pageCountPerFile, pageCount);

        const promise = limit(async () => {
          const newDoc = await PDFDocument.create();
          const copiedPages = await newDoc.copyPages(
            srcDoc,
            Array.from(
              { length: endIndex - startIndex },
              (_, j) => j + startIndex
            )
          );
          copiedPages.forEach(page => {
            newDoc.addPage(page);
          });

          const filename = `${this.pdfFile?.filename.replace('.pdf', '')}_part${
            i + 1
          }.pdf`;
          const pdfBytes = await newDoc.save();
          await fs.writeFile(filename, pdfBytes);
          console.log(`Split PDF file saved to ${filename}`);
        });

        promises.push(promise);
      }

      await Promise.all(promises);
    } catch (error: any) {
      console.error(`Error splitting PDF file: ${error.message}`);
      throw error;
    }
  }
}

async function splitPdfFile(
  filepath: string,
  pageCountPerFile: number,
  maxConcurrent: number
) {
  const pdfSplitter = new PdfSplitter();
  try {
    await pdfSplitter.loadPdfFile(filepath);
    await pdfSplitter.splitPdfFile(pageCountPerFile, maxConcurrent);
  } catch (error: any) {
    console.error(
      `An error occurred while splitting PDF file: ${error.message}`
    );
  }
}

splitPdfFile('original.pdf', 1, 4);
