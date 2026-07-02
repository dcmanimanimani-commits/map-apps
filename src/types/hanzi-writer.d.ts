declare module 'hanzi-writer' {
  interface HanziWriterOptions {
    width?: number;
    height?: number;
    padding?: number;
    showOutline?: boolean;
    strokeColor?: string;
    outlineColor?: string;
    drawingColor?: string;
    drawingWidth?: number;
    highlightColor?: string;
  }

  interface QuizOptions {
    showHintAfterMisses?: number;
    highlightOnComplete?: boolean;
    onComplete?: () => void;
    onCorrectStroke?: (data: unknown) => void;
  }

  export default class HanziWriter {
    static create(
      element: HTMLElement | string,
      character: string,
      options?: HanziWriterOptions,
    ): HanziWriter;
    animateCharacter(): void;
    quiz(options?: QuizOptions): void;
  }
}
