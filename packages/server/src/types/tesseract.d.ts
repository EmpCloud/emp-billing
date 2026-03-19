declare module "tesseract.js" {
  interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
    };
  }

  interface Worker {
    recognize(image: Buffer | string): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  export function createWorker(lang: string): Promise<Worker>;
}
