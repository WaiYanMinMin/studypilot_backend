declare module "pdf-parse-debugging-disabled" {
  type PdfPage = {
    pageIndex: number;
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  };

  type PdfOptions = {
    pagerender?: (pageData: PdfPage) => Promise<string>;
  };

  export default function pdf(
    dataBuffer: Buffer,
    options?: PdfOptions
  ): Promise<unknown>;
}
