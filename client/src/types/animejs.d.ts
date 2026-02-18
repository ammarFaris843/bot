declare module "animejs" {
  interface AnimeParams {
    targets?: any;
    duration?: number;
    delay?: number | ((el: Element, i: number, l: number) => number);
    easing?: string;
    loop?: boolean | number;
    direction?: string;
    autoplay?: boolean;
    round?: number;
    complete?: (anim: AnimeInstance) => void;
    update?: (anim: AnimeInstance) => void;
    begin?: (anim: AnimeInstance) => void;
    [prop: string]: any;
  }

  interface AnimeInstance {
    play(): void;
    pause(): void;
    restart(): void;
    reverse(): void;
    seek(time: number): void;
    finished: Promise<void>;
  }

  interface AnimeTimelineInstance extends AnimeInstance {
    add(params: AnimeParams, offset?: string | number): AnimeTimelineInstance;
  }

  interface AnimeStatic {
    (params: AnimeParams): AnimeInstance;
    timeline(params?: AnimeParams): AnimeTimelineInstance;
    stagger(
      value: number | string,
      options?: {
        start?: number;
        from?: number | string;
        direction?: string;
        easing?: string;
        grid?: [number, number];
        axis?: string;
      }
    ): (el: Element, i: number) => number;
    set(targets: any, props: object): void;
    get(targets: any, prop: string): string | number;
    remove(targets: any): void;
    running: AnimeInstance[];
  }

  const anime: AnimeStatic;
  export default anime;
}
