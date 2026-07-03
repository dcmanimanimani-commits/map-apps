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
    leniency?: number;
    averageDistanceThreshold?: number;
    showHintAfterMisses?: number | false;
    markStrokeCorrectAfterMisses?: number | false;
    acceptBackwardsStrokes?: boolean;
  }

  interface QuizOptions {
    showHintAfterMisses?: number | false;
    highlightOnComplete?: boolean;
    leniency?: number;
    averageDistanceThreshold?: number;
    markStrokeCorrectAfterMisses?: number | false;
    acceptBackwardsStrokes?: boolean;
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
